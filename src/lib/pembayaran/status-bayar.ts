// Status konfirmasi pembayaran yang dilihat penyewa setelah membuka instruksi bayar — dibandingkan
// dengan keadaan tagihan saat instruksi dibuat. Status Lunas hanya dari webhook payment gateway.

import type { PembayaranPublik } from "../data/invoice-publik.ts";
import type { InvoiceStatus } from "@/lib/types";

export type StatusKonfirmasi =
  /** Belum ada pembayaran baru. */
  | "menunggu"
  /** Pembayaran baru tercatat tapi masih diproses gateway. */
  | "diproses"
  /** Tagihan lunas. */
  | "lunas"
  /** Uang baru masuk tapi nominalnya belum cocok — diperiksa pemilik kos. */
  | "diperiksa";

type KeadaanTagihan = { status: InvoiceStatus; sudahDiterima: number; pembayaran: Pick<PembayaranPublik, "status">[] };

export function statusKonfirmasi(awal: Pick<KeadaanTagihan, "sudahDiterima" | "pembayaran">, kini: KeadaanTagihan): StatusKonfirmasi {
  if (kini.status === "lunas") return "lunas";
  if (kini.status === "perlu_review" && kini.sudahDiterima > awal.sudahDiterima) return "diperiksa";
  const baru = kini.pembayaran.slice(awal.pembayaran.length);
  return baru.some((p) => p.status === "pending") ? "diproses" : "menunggu";
}

/** true bila tidak perlu dicek lagi. */
export const statusAkhir = (s: StatusKonfirmasi) => s === "lunas" || s === "diperiksa";

/** Jeda cek status otomatis. */
export const JEDA_CEK_STATUS_MS = 5_000;
