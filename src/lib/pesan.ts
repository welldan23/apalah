// Template pesan WhatsApp ke penyewa. Angka & tanggal selalu dari database, bukan AI.

import { formatPeriode, formatRupiah, formatTanggal, selisihHari } from "./format.ts";
import type { TemplateWhatsApp } from "./whatsapp/index.ts";
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

/**
 * Template pengingat untuk WhatsApp Cloud API (Meta) — pesan yang dimulai bisnis wajib template yang
 * disetujui. Daftarkan di WhatsApp Manager persis seperti ini: kategori Utility, bahasa Indonesia
 * (id), isi berikut, dan satu tombol URL "Lihat tagihan" ke `{APP_URL}/invoice/{{1}}` (diisi token
 * invoice). Provider teks (WAHA, log) mengirim isi yang sama plus link invoice di baris terakhir.
 */
export const TEMPLATE_PENGINGAT = {
  sebelum: {
    nama: "kostera_pengingat_sebelum",
    isi: "Halo {{1}}, pengingat dari {{2}}: tagihan sewa kamar {{3}} periode {{4}} sebesar {{5}} jatuh tempo {{6}}. Silakan bayar lewat link invoice berikut. Terima kasih.",
  },
  lewat: {
    nama: "kostera_pengingat_lewat",
    isi: "Halo {{1}}, ini pengingat dari {{2}}. Tagihan sewa kamar {{3}} periode {{4}} sebesar {{5}} sudah lewat jatuh tempo ({{6}}). Silakan bayar lewat link invoice berikut. Terima kasih.",
  },
} as const;

/** Ganti variabel {{1}}, {{2}}, … dengan nilai berurutan. */
export const isiTemplate = (isi: string, variabel: string[]) =>
  isi.replace(/\{\{(\d+)\}\}/g, (_, n: string) => variabel[Number(n) - 1] ?? "");

const denganLink = (pesan: string, linkInvoice?: string) => (linkInvoice ? `${pesan}\n${linkInvoice}` : pesan);

/** Variabel {{1}}–{{6}} template pengingat; {{6}} = kapan jatuh tempo. */
function variabelPengingat(inv: DataTagihan, namaKos: string, kapan: string) {
  return [inv.namaPenghuni.split(" ")[0], namaKos, inv.nomorKamar, formatPeriode(inv.periode), formatRupiah(inv.nominal), kapan];
}

function kapanJatuhTempo(inv: DataTagihan, hariIni: string) {
  const sisa = selisihHari(hariIni, inv.jatuhTempo);
  return sisa <= 0 ? "hari ini" : `${formatTanggal(inv.jatuhTempo)} (${sisa} hari lagi)`;
}

/** Pesan pengingat untuk tagihan yang sudah lewat jatuh tempo. */
export function pesanReminder(inv: DataTagihan, namaKos: string, linkInvoice?: string) {
  const variabel = variabelPengingat(inv, namaKos, formatTanggal(inv.jatuhTempo));
  return denganLink(isiTemplate(TEMPLATE_PENGINGAT.lewat.isi, variabel), linkInvoice);
}

/** Pengingat sebelum atau tepat di hari jatuh tempo. */
export function pesanPengingatAwal(inv: DataTagihan, namaKos: string, hariIni: string, linkInvoice?: string) {
  const variabel = variabelPengingat(inv, namaKos, kapanJatuhTempo(inv, hariIni));
  return denganLink(isiTemplate(TEMPLATE_PENGINGAT.sebelum.isi, variabel), linkInvoice);
}

/** Template pengingat sesuai waktu: sudah lewat jatuh tempo atau belum. */
export function pesanPengingat(inv: DataTagihan, namaKos: string, hariIni: string, linkInvoice?: string) {
  return inv.jatuhTempo < hariIni
    ? pesanReminder(inv, namaKos, linkInvoice)
    : pesanPengingatAwal(inv, namaKos, hariIni, linkInvoice);
}

/** Template WhatsApp resmi yang isinya sama dengan pesanPengingat; tombol mengarah ke invoice `tokenInvoice`. */
export function templatePengingat(inv: DataTagihan, namaKos: string, hariIni: string, tokenInvoice: string): TemplateWhatsApp {
  const lewat = inv.jatuhTempo < hariIni;
  return {
    nama: lewat ? TEMPLATE_PENGINGAT.lewat.nama : TEMPLATE_PENGINGAT.sebelum.nama,
    bahasa: "id",
    variabel: variabelPengingat(inv, namaKos, lewat ? formatTanggal(inv.jatuhTempo) : kapanJatuhTempo(inv, hariIni)),
    tombolUrl: tokenInvoice,
  };
}

/**
 * Template autentikasi (WhatsApp Cloud API) untuk kode OTP: daftarkan dengan kategori Authentication,
 * bahasa Indonesia (id), dan tombol "Salin kode". Isinya baku dari Meta; variabel {{1}} = kode.
 */
export const TEMPLATE_OTP = { nama: "kostera_kode_otp" } as const;

/** Pesan kode OTP untuk provider teks (WAHA, log). */
export function pesanOtp(kode: string, masaBerlakuMenit: number) {
  return `Kode verifikasi Kostera kamu: ${kode}. Berlaku ${masaBerlakuMenit} menit. Jangan berikan kode ini ke siapa pun, termasuk yang mengaku dari Kostera.`;
}

/** Template OTP resmi: kode di isi pesan dan di tombol salin kode. */
export function templateOtp(kode: string): TemplateWhatsApp {
  return { nama: TEMPLATE_OTP.nama, bahasa: "id", variabel: [kode], tombolUrl: kode };
}
