// Aksi cepat "Kirim reminder": kirim pengingat WhatsApp untuk tagihan belum dibayar yang dipilih
// owner (setelah preview), lalu catat setiap kiriman di riwayat reminder.

import { schema, type Db } from "../../db/index.ts";
import { hariIniWib } from "../waktu.ts";
import { kirimAman, type HasilKirim, type PengirimWhatsApp } from "../whatsapp/index.ts";
import { GalatAksi } from "./galat.ts";
import { susunPesanReminder, type PesanReminder } from "./pesan-reminder.ts";

const { reminders } = schema;

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
  { baseUrl, hariIni = hariIniWib() }: { baseUrl: string; hariIni?: string },
): Promise<HasilKirimReminder> {
  const pesan = await susunPesanReminder(db, organizationId, input.invoiceIds, { baseUrl, hariIni });

  // Dikirim satu per satu supaya tidak membanjiri provider WhatsApp.
  const hasil: { p: PesanReminder; kirim: HasilKirim }[] = [];
  for (const p of pesan) {
    hasil.push({ p, kirim: await kirimAman(wa, { ke: p.nomorWa, teks: p.teks }) });
  }

  await db.insert(reminders).values(
    hasil.map(({ p, kirim }) => ({
      organizationId,
      invoiceId: p.invoiceId,
      tenantId: p.tenantId,
      jenis: "manual",
      kanal: "whatsapp",
      status: kirim.ok ? ("terkirim" as const) : ("gagal" as const),
      galat: kirim.ok ? null : kirim.galat,
    })),
  );

  return {
    terkirim: hasil.filter((h) => h.kirim.ok).length,
    gagal: hasil.filter((h) => !h.kirim.ok).map((h) => h.p.nomorKamar),
    simulasi: wa.simulasi,
  };
}
