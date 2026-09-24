// Konfirmasi "Kirim reminder" (massal): kirim pengingat WhatsApp untuk tagihan belum dibayar yang
// dipilih owner setelah preview, lalu catat setiap kiriman di riwayat reminder.
// Aturan sama dengan preview: penyewa yang sudah dihubungi (atau sedang dikirimi) dalam 24 jam
// terakhir dilewati. Penerima diklaim dulu dalam transaksi berkunci kos, jadi konfirmasi ganda atau
// bersamaan (mis. dua admin, atau penjadwal otomatis) tidak mengirim dobel.

import { and, eq, gt, inArray } from "drizzle-orm";

import { schema, type Db } from "../../db/index.ts";
import { kontakPenyewa } from "../data/reminder.ts";
import { GALAT_TERPUTUS, JEDA_PENGINGAT_JAM } from "../reminder.ts";
import { hariIniWib } from "../waktu.ts";
import { kirimAman, type PengirimWhatsApp } from "../whatsapp/index.ts";
import { GalatAksi } from "./galat.ts";
import { susunPesanReminder, type PesanReminder } from "./pesan-reminder.ts";

const { organizations, reminders } = schema;

export type InputKirimReminder = { invoiceIds: string[] };

export type HasilKirimReminder = {
  terkirim: number;
  /** Nomor kamar yang gagal dikirimi. */
  gagal: string[];
  /** Nomor kamar yang tidak dikirimi karena penyewanya sudah dihubungi dalam 24 jam terakhir. */
  dilewati: string[];
  /** true bila provider WhatsApp masih mode pengembangan (pesan tidak benar-benar terkirim). */
  simulasi: boolean;
};

export function bacaInputKirimReminder(body: Record<string, unknown>): InputKirimReminder {
  const { invoiceIds } = body;
  if (
    !Array.isArray(invoiceIds) ||
    invoiceIds.length === 0 ||
    invoiceIds.length > 500 ||
    !invoiceIds.every((id) => typeof id === "string")
  ) {
    throw new GalatAksi("Pilih minimal satu tagihan.");
  }
  return { invoiceIds: [...new Set(invoiceIds as string[])] };
}

export async function kirimReminder(
  db: Db,
  organizationId: string,
  input: InputKirimReminder,
  wa: PengirimWhatsApp,
  { baseUrl, hariIni = hariIniWib(), sekarang = new Date() }: { baseUrl: string; hariIni?: string; sekarang?: Date },
): Promise<HasilKirimReminder> {
  const pesan = await susunPesanReminder(db, organizationId, input.invoiceIds, { baseUrl, hariIni });

  // Klaim penerima: transaksi singkat (tanpa panggilan WhatsApp) dengan baris kos dikunci.
  const { diklaim, dilewati } = await db.transaction(async (tx) => {
    await tx.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, organizationId)).for("update");
    const baru = await tx
      .selectDistinct({ tenantId: reminders.tenantId })
      .from(reminders)
      .where(
        and(
          inArray(reminders.tenantId, [...new Set(pesan.map((p) => p.tenantId))]),
          kontakPenyewa(),
          gt(reminders.terkirimPada, new Date(sekarang.getTime() - JEDA_PENGINGAT_JAM * 3_600_000)),
        ),
      );
    const sudahDihubungi = new Set(baru.map((r) => r.tenantId));
    const dikirim = pesan.filter((p) => !sudahDihubungi.has(p.tenantId));
    const klaim = dikirim.length
      ? await tx
          .insert(reminders)
          .values(
            dikirim.map((p) => ({
              organizationId,
              invoiceId: p.invoiceId,
              tenantId: p.tenantId,
              jenis: "manual",
              kanal: "whatsapp",
              status: "gagal" as const,
              galat: GALAT_TERPUTUS,
              terkirimPada: sekarang,
            })),
          )
          .returning({ id: reminders.id, invoiceId: reminders.invoiceId })
      : [];
    const idKlaim = new Map(klaim.map((k) => [k.invoiceId, k.id]));
    return {
      diklaim: dikirim.map((p) => ({ p, id: idKlaim.get(p.invoiceId)! })),
      dilewati: pesan.filter((p) => sudahDihubungi.has(p.tenantId)),
    };
  });

  // Dikirim satu per satu supaya tidak membanjiri provider WhatsApp; hasilnya menimpa klaim.
  const hasil: { p: PesanReminder; ok: boolean }[] = [];
  for (const { p, id } of diklaim) {
    const kirim = await kirimAman(wa, { ke: p.nomorWa, teks: p.teks, template: p.template });
    await db
      .update(reminders)
      .set({ status: kirim.ok ? "terkirim" : "gagal", galat: kirim.ok ? null : kirim.galat })
      .where(eq(reminders.id, id));
    hasil.push({ p, ok: kirim.ok });
  }

  return {
    terkirim: hasil.filter((h) => h.ok).length,
    gagal: hasil.filter((h) => !h.ok).map((h) => h.p.nomorKamar),
    dilewati: dilewati.map((p) => p.nomorKamar),
    simulasi: wa.simulasi,
  };
}
