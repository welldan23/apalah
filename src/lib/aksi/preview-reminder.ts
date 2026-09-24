// Preview reminder massal: penerima, isi pesan persis seperti yang akan dikirim, total, dan penyewa
// yang dilewati karena sudah dihubungi dalam 24 jam terakhir — sebelum owner mengonfirmasi.

import { and, eq, inArray, max, ne } from "drizzle-orm";

import { schema, type Db } from "../../db/index.ts";
import { bolehDiingatkan } from "../reminder.ts";
import { susunPesanReminder } from "./pesan-reminder.ts";

const { reminders } = schema;

export type PenerimaPreview = {
  invoiceId: string;
  nomorKamar: string;
  namaPenghuni: string;
  periode: string;
  nominal: number;
  jatuhTempo: string;
  /** Isi pesan WhatsApp, termasuk link invoice. */
  pesan: string;
};

export type PreviewReminder = {
  penerima: PenerimaPreview[];
  /** Tidak ikut dikirim: penyewanya sudah dihubungi dalam 24 jam terakhir. */
  dilewati: (Omit<PenerimaPreview, "pesan"> & { terakhirDihubungi: string })[];
  total: number;
  /** Periode tagihan penerima, urut. */
  periode: string[];
};

export async function previewReminder(
  db: Db,
  organizationId: string,
  invoiceIds: string[],
  { baseUrl, sekarang = new Date(), hariIni }: { baseUrl: string; hariIni: string; sekarang?: Date },
): Promise<PreviewReminder> {
  const pesan = await susunPesanReminder(db, organizationId, invoiceIds, { baseUrl, hariIni });
  if (pesan.length === 0) return { penerima: [], dilewati: [], total: 0, periode: [] };

  // Kontak terakhir per penyewa (pesan terkirim apa pun selain konfirmasi lunas) — aturan sama
  // dengan pilihan penerima & pengingat otomatis.
  const kontak = await db
    .select({ tenantId: reminders.tenantId, waktu: max(reminders.terkirimPada) })
    .from(reminders)
    .where(
      and(
        eq(reminders.organizationId, organizationId),
        inArray(reminders.tenantId, [...new Set(pesan.map((p) => p.tenantId))]),
        eq(reminders.status, "terkirim"),
        ne(reminders.jenis, "konfirmasi_lunas"),
      ),
    )
    .groupBy(reminders.tenantId);
  const terakhir = new Map(kontak.map((k) => [k.tenantId, k.waktu?.toISOString()]));

  const hasil: PreviewReminder = { penerima: [], dilewati: [], total: 0, periode: [] };
  for (const p of pesan) {
    const data = {
      invoiceId: p.invoiceId,
      nomorKamar: p.nomorKamar,
      namaPenghuni: p.namaPenghuni,
      periode: p.periode,
      nominal: p.nominal,
      jatuhTempo: p.jatuhTempo,
    };
    const waktu = terakhir.get(p.tenantId);
    if (!bolehDiingatkan(waktu, sekarang)) {
      hasil.dilewati.push({ ...data, terakhirDihubungi: waktu! });
      continue;
    }
    hasil.penerima.push({ ...data, pesan: p.teks });
    hasil.total += p.nominal;
  }
  hasil.periode = [...new Set(hasil.penerima.map((p) => p.periode))].sort();
  return hasil;
}
