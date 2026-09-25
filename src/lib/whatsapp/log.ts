// Kirim WhatsApp + catat metadatanya di whatsapp_logs (tanpa isi pesan). Dipakai semua pengirim
// pesan keluar supaya ada satu log untuk audit, biaya, dan pelacakan kegagalan.

import { schema, type Db } from "../../db/index.ts";
import { kirimAman, type HasilKirim, type PengirimWhatsApp, type PesanWhatsApp } from "./index.ts";

export type JenisPesanWa = "pengingat" | "tagihan" | "konfirmasi_lunas" | "perlu_review" | "kosta" | "otp" | "tiket";

export type KonteksKirimWa = {
  jenis: JenisPesanWa;
  /** Kosong untuk pesan di luar kos tertentu (OTP). */
  organizationId?: string | null;
  /** Baris terkait: reminder, invoice, pesan Kosta, tiket. */
  referensiId?: string | null;
};

/** Kirim tanpa melempar, lalu catat. Gagal mencatat tidak membatalkan hasil kiriman. */
export async function kirimDanCatat(
  db: Pick<Db, "insert">,
  wa: PengirimWhatsApp,
  pesan: PesanWhatsApp,
  { jenis, organizationId = null, referensiId = null }: KonteksKirimWa,
): Promise<HasilKirim> {
  const hasil = await kirimAman(wa, pesan);
  try {
    await db.insert(schema.whatsappLogs).values({
      organizationId,
      tujuan: pesan.ke,
      jenis,
      referensiId,
      provider: wa.provider,
      template: pesan.template?.nama ?? null,
      status: hasil.ok ? "terkirim" : "gagal",
      galat: hasil.ok ? null : hasil.galat,
      idPesanProvider: hasil.ok ? (hasil.id ?? null) : null,
    });
  } catch (err) {
    console.error(`[whatsapp] log ${jenis} ke ${pesan.ke.slice(0, 5)}… gagal dicatat:`, err);
  }
  return hasil;
}
