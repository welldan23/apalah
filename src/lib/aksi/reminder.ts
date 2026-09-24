// Aksi cepat "Kirim reminder": kirim pengingat WhatsApp untuk tagihan jatuh tempo yang
// dipilih owner (setelah preview), lalu catat setiap kiriman di riwayat reminder.

import { and, eq, inArray } from "drizzle-orm";

import { schema, type Db } from "../../db/index.ts";
import { pesanReminder } from "../pesan.ts";
import { kirimAman, type HasilKirim, type PengirimWhatsApp } from "../whatsapp/index.ts";
import { GalatAksi } from "./galat.ts";

const { invoices, organizations, reminders, rooms, tenants } = schema;

export type InputKirimReminder = { invoiceIds: string[] };

export type HasilKirimReminder = {
  terkirim: number;
  /** Nomor kamar yang gagal dikirimi. */
  gagal: string[];
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
  { baseUrl }: { baseUrl: string },
): Promise<HasilKirimReminder> {
  const [kos] = await db
    .select({ namaKos: organizations.namaKos })
    .from(organizations)
    .where(eq(organizations.id, organizationId));
  if (!kos) throw new GalatAksi("Kos tidak ditemukan.", 404);

  const tagihan = await db
    .select({
      id: invoices.id,
      tenantId: invoices.tenantId,
      periode: invoices.periode,
      nominal: invoices.nominal,
      jatuhTempo: invoices.jatuhTempo,
      status: invoices.status,
      tokenPublik: invoices.tokenPublik,
      namaPenghuni: tenants.nama,
      nomorWa: tenants.nomorWa,
      nomorKamar: rooms.nomorKamar,
    })
    .from(invoices)
    .innerJoin(tenants, eq(tenants.id, invoices.tenantId))
    .innerJoin(rooms, eq(rooms.id, invoices.roomId))
    .where(and(eq(invoices.organizationId, organizationId), inArray(invoices.id, input.invoiceIds)));

  if (tagihan.length !== input.invoiceIds.length) {
    throw new GalatAksi("Sebagian tagihan tidak ditemukan.", 404);
  }
  const bukanJatuhTempo = tagihan.filter((t) => t.status !== "jatuh_tempo");
  if (bukanJatuhTempo.length > 0) {
    const kamar = bukanJatuhTempo.map((t) => t.nomorKamar).join(", ");
    throw new GalatAksi(`Hanya tagihan jatuh tempo yang bisa diingatkan (kamar ${kamar}).`, 409);
  }

  // Dikirim satu per satu supaya tidak membanjiri provider WhatsApp.
  const hasil: { t: (typeof tagihan)[number]; kirim: HasilKirim }[] = [];
  for (const t of tagihan) {
    const teks = pesanReminder(t, kos.namaKos, `${baseUrl}/invoice/${t.tokenPublik}`);
    hasil.push({ t, kirim: await kirimAman(wa, { ke: t.nomorWa, teks }) });
  }

  await db.insert(reminders).values(
    hasil.map(({ t, kirim }) => ({
      organizationId,
      invoiceId: t.id,
      tenantId: t.tenantId,
      jenis: "manual",
      kanal: "whatsapp",
      status: kirim.ok ? ("terkirim" as const) : ("gagal" as const),
      galat: kirim.ok ? null : kirim.galat,
    })),
  );

  return {
    terkirim: hasil.filter((h) => h.kirim.ok).length,
    gagal: hasil.filter((h) => !h.kirim.ok).map((h) => h.t.nomorKamar),
    simulasi: wa.simulasi,
  };
}
