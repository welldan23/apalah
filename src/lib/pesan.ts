// Template pesan WhatsApp ke penyewa. Angka & tanggal selalu dari database, bukan AI.

import { formatPeriode, formatRupiah, formatTanggal } from "./format.ts";
import type { InvoiceRow } from "@/lib/types";

type DataTagihan = Pick<InvoiceRow, "namaPenghuni" | "nomorKamar" | "periode" | "nominal" | "jatuhTempo">;

/** Pesan tagihan baru untuk penyewa, berisi link invoice. */
export function pesanTagihan(inv: DataTagihan, namaKos: string, linkInvoice: string) {
  const namaDepan = inv.namaPenghuni.split(" ")[0];
  return `Halo ${namaDepan}, ini tagihan sewa kamar ${inv.nomorKamar} di ${namaKos} periode ${formatPeriode(inv.periode)} sebesar ${formatRupiah(inv.nominal)}, jatuh tempo ${formatTanggal(inv.jatuhTempo)}. Rincian dan cara bayar ada di link berikut. Terima kasih.\n${linkInvoice}`;
}

/** Pesan pengingat untuk tagihan yang sudah lewat jatuh tempo. */
export function pesanReminder(inv: DataTagihan, namaKos: string, linkInvoice?: string) {
  const namaDepan = inv.namaPenghuni.split(" ")[0];
  const pesan = `Halo ${namaDepan}, ini pengingat dari ${namaKos}. Tagihan sewa kamar ${inv.nomorKamar} periode ${formatPeriode(inv.periode)} sebesar ${formatRupiah(inv.nominal)} sudah lewat jatuh tempo (${formatTanggal(inv.jatuhTempo)}). Silakan bayar lewat link invoice berikut. Terima kasih.`;
  return linkInvoice ? `${pesan}\n${linkInvoice}` : pesan;
}
