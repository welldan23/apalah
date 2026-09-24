// Penjadwal status jatuh tempo — dijalankan harian oleh cron (GET /api/cron/harian).
// Tagihan Menunggu/Terkirim yang tanggal jatuh temponya sudah lewat menjadi Jatuh tempo.

import { and, inArray, lt } from "drizzle-orm";

import { schema, type Db } from "../../db/index.ts";

const { invoices } = schema;

/** Tandai tagihan lewat jatuh tempo pada `hariIni` (YYYY-MM-DD, WIB); mengembalikan jumlahnya. */
export async function tandaiJatuhTempo(db: Db, hariIni: string) {
  const diubah = await db
    .update(invoices)
    .set({ status: "jatuh_tempo" })
    .where(and(inArray(invoices.status, ["menunggu", "terkirim"]), lt(invoices.jatuhTempo, hariIni)))
    .returning({ id: invoices.id });
  return diubah.length;
}
