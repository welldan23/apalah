// Pencocokan nominal pembayaran dengan tagihan — deterministik, tanpa AI.
// Yang dibandingkan adalah TOTAL uang yang sudah diterima untuk tagihan itu (termasuk pembayaran
// sebelumnya yang belum cocok), sehingga pelunasan kekurangan membuat tagihan Lunas, sedangkan
// kurang bayar, lebih bayar, atau bayar ganda ditandai Perlu review.

import { formatRupiah } from "../format.ts";

export type KeputusanPencocokan =
  | { alasan: "cocok"; statusInvoice: "lunas"; statusPembayaran: "valid"; selisih: 0 }
  | { alasan: "kurang" | "lebih"; statusInvoice: "perlu_review"; statusPembayaran: "tidak_cocok"; selisih: number };

export function cocokkanNominal({
  nominalTagihan,
  sudahDiterima,
  nominalBayar,
}: {
  nominalTagihan: number;
  /** Uang yang sudah diterima sebelumnya untuk tagihan ini (valid + tidak cocok). */
  sudahDiterima: number;
  nominalBayar: number;
}): KeputusanPencocokan {
  const selisih = sudahDiterima + nominalBayar - nominalTagihan;
  if (selisih === 0) return { alasan: "cocok", statusInvoice: "lunas", statusPembayaran: "valid", selisih: 0 };
  return {
    alasan: selisih < 0 ? "kurang" : "lebih",
    statusInvoice: "perlu_review",
    statusPembayaran: "tidak_cocok",
    selisih,
  };
}

/** "lunas" / "perlu_review: kurang Rp50.000" — untuk catatan webhook_events. */
export const ringkasKeputusan = (k: KeputusanPencocokan) =>
  k.alasan === "cocok" ? "lunas" : `perlu_review: ${k.alasan} ${formatRupiah(Math.abs(k.selisih))}`;
