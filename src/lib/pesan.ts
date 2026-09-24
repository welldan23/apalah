// Template pesan WhatsApp ke penyewa. Angka & tanggal selalu dari database, bukan AI.

import { formatPeriode, formatRupiah, formatTanggal, selisihHari } from "./format.ts";
import type { InvoiceRow } from "@/lib/types";

type DataTagihan = Pick<InvoiceRow, "namaPenghuni" | "nomorKamar" | "periode" | "nominal" | "jatuhTempo">;

/** Pesan tagihan baru untuk penyewa, berisi link invoice. */
export function pesanTagihan(inv: DataTagihan, namaKos: string, linkInvoice: string) {
  const namaDepan = inv.namaPenghuni.split(" ")[0];
  return `Halo ${namaDepan}, ini tagihan sewa kamar ${inv.nomorKamar} di ${namaKos} periode ${formatPeriode(inv.periode)} sebesar ${formatRupiah(inv.nominal)}, jatuh tempo ${formatTanggal(inv.jatuhTempo)}. Rincian dan cara bayar ada di link berikut. Terima kasih.\n${linkInvoice}`;
}

/** Konfirmasi ke penyewa setelah pembayaran terverifikasi dan tagihan Lunas. */
export function pesanLunas(inv: DataTagihan, namaKos: string, linkInvoice: string) {
  const namaDepan = inv.namaPenghuni.split(" ")[0];
  return `Halo ${namaDepan}, pembayaran sewa kamar ${inv.nomorKamar} di ${namaKos} periode ${formatPeriode(inv.periode)} sebesar ${formatRupiah(inv.nominal)} sudah kami terima. Terima kasih! Bukti pembayaran:\n${linkInvoice}`;
}

/** Pesan pengingat untuk tagihan yang sudah lewat jatuh tempo. */
export function pesanReminder(inv: DataTagihan, namaKos: string, linkInvoice?: string) {
  const namaDepan = inv.namaPenghuni.split(" ")[0];
  const pesan = `Halo ${namaDepan}, ini pengingat dari ${namaKos}. Tagihan sewa kamar ${inv.nomorKamar} periode ${formatPeriode(inv.periode)} sebesar ${formatRupiah(inv.nominal)} sudah lewat jatuh tempo (${formatTanggal(inv.jatuhTempo)}). Silakan bayar lewat link invoice berikut. Terima kasih.`;
  return linkInvoice ? `${pesan}\n${linkInvoice}` : pesan;
}

/** Pengingat sebelum atau tepat di hari jatuh tempo. */
export function pesanPengingatAwal(inv: DataTagihan, namaKos: string, hariIni: string, linkInvoice?: string) {
  const namaDepan = inv.namaPenghuni.split(" ")[0];
  const sisa = selisihHari(hariIni, inv.jatuhTempo);
  const kapan = sisa <= 0 ? "hari ini" : `${formatTanggal(inv.jatuhTempo)} (${sisa} hari lagi)`;
  const pesan = `Halo ${namaDepan}, pengingat dari ${namaKos}: tagihan sewa kamar ${inv.nomorKamar} periode ${formatPeriode(inv.periode)} sebesar ${formatRupiah(inv.nominal)} jatuh tempo ${kapan}. Silakan bayar lewat link invoice berikut. Terima kasih.`;
  return linkInvoice ? `${pesan}\n${linkInvoice}` : pesan;
}

/** Template pengingat sesuai waktu: sudah lewat jatuh tempo atau belum. */
export function pesanPengingat(inv: DataTagihan, namaKos: string, hariIni: string, linkInvoice?: string) {
  return inv.jatuhTempo < hariIni
    ? pesanReminder(inv, namaKos, linkInvoice)
    : pesanPengingatAwal(inv, namaKos, hariIni, linkInvoice);
}
