// Keterangan tampilan invoice yang dipakai beberapa halaman.

import { formatTanggalPendek, selisihHari } from "./format.ts";
import type { InvoiceRow } from "@/lib/types";

/** Keterangan waktu: kapan dibayar, atau seberapa dekat/lewat jatuh tempo. */
export function keteranganWaktu(
  inv: Pick<InvoiceRow, "status" | "dibayarPada" | "jatuhTempo">,
  hariIni: string,
) {
  if (inv.status === "lunas" && inv.dibayarPada) {
    return { teks: `Dibayar ${formatTanggalPendek(inv.dibayarPada)}`, telat: false };
  }
  const sisa = selisihHari(hariIni, inv.jatuhTempo);
  if (sisa < 0) return { teks: `Lewat ${-sisa} hari`, telat: true };
  if (sisa === 0) return { teks: "Jatuh tempo hari ini", telat: false };
  return { teks: `${sisa} hari lagi`, telat: false };
}
