// Kontrak data halaman status tiket penyewa (/invoice/[token]/tiket/status) — dibuka lewat tautan
// invoice tanpa login; hanya tiket milik penyewa & kamar pada invoice itu.
// Tahap frontend: tiket dari data contoh; tahap backend: tabel tickets.

import { getDb } from "@/db";
import { getInvoicePublik } from "@/lib/data/invoice-publik";
import { mockTiketPerKamar } from "@/lib/mock/tiket";
import { urutkanTiket, type TiketPenyewa } from "@/lib/tiket";

export type HalamanStatusTiket = {
  namaKos: string;
  namaPenghuni: string;
  nomorKamar: string;
  tiket: TiketPenyewa[];
};

/** null bila token tidak dikenal. */
export async function getHalamanStatusTiket(token: string): Promise<HalamanStatusTiket | null> {
  const inv = await getInvoicePublik(await getDb(), token);
  if (!inv) return null;
  return {
    namaKos: inv.namaKos,
    namaPenghuni: inv.namaPenghuni,
    nomorKamar: inv.nomorKamar,
    tiket: urutkanTiket(mockTiketPerKamar[inv.nomorKamar] ?? []),
  };
}
