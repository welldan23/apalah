// Template pesan WhatsApp ke penyewa. Angka & tanggal selalu dari database, bukan AI.

import { formatPeriode, formatRupiah, formatTanggal, selisihHari } from "./format.ts";
import type { TemplateWhatsApp } from "./whatsapp/index.ts";
import type { InvoiceRow } from "@/lib/types";

type DataTagihan = Pick<InvoiceRow, "namaPenghuni" | "nomorKamar" | "periode" | "nominal" | "jatuhTempo">;

// Template resmi WhatsApp Cloud API (Meta) — pesan yang dimulai bisnis ke penyewa wajib template
// yang disetujui. Daftarkan di WhatsApp Manager persis seperti di bawah: kategori Utility, bahasa
// Indonesia (id), isi berikut, dan satu tombol URL ("Lihat tagihan" / "Lihat bukti bayar") ke
// `{APP_URL}/invoice/{{1}}` (diisi token invoice). Provider teks (WAHA, log) mengirim isi yang sama
// plus link invoice di baris terakhir.

/** Tagihan baru; {{1}} nama depan, {{2}} kamar, {{3}} kos, {{4}} periode, {{5}} nominal, {{6}} jatuh tempo. */
export const TEMPLATE_TAGIHAN = {
  nama: "kostera_tagihan_baru",
  isi: "Halo {{1}}, ini tagihan sewa kamar {{2}} di {{3}} periode {{4}} sebesar {{5}}, jatuh tempo {{6}}. Rincian dan cara bayar ada di link berikut. Terima kasih.",
} as const;

/** Pembayaran diterima (Lunas); variabel {{1}}–{{5}} sama dengan tagihan baru. */
export const TEMPLATE_LUNAS = {
  nama: "kostera_pembayaran_diterima",
  isi: "Halo {{1}}, pembayaran sewa kamar {{2}} di {{3}} periode {{4}} sebesar {{5}} sudah kami terima. Terima kasih! Bukti pembayaran:",
} as const;

/** Pengingat bayar; {{1}} nama depan, {{2}} kos, {{3}} kamar, {{4}} periode, {{5}} nominal, {{6}} kapan jatuh tempo. */
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

/**
 * Kabar tindak lanjut tiket keluhan; {{1}} nama depan, {{2}} nomor tiket, {{3}} jenis masalah,
 * {{4}} kamar, {{5}} kos, {{6}} status. Tombol URL ke `{APP_URL}/invoice/{{1}}` diisi
 * "<token>/tiket/status" sehingga membuka halaman status tiket penyewa.
 */
export const TEMPLATE_TIKET = {
  nama: "kostera_tiket_diperbarui",
  isi: "Halo {{1}}, tiket {{2}} ({{3}}) untuk kamar {{4}} di {{5}} sekarang {{6}}. Detailnya ada di link berikut.",
} as const;

/**
 * Ke owner/admin saat nominal pembayaran tidak cocok (Perlu review). Pesan yang dimulai bisnis, jadi
 * wajib template walau penerimanya owner. {{1}} kos, {{2}} kamar, {{3}} penyewa, {{4}} periode,
 * {{5}} uang diterima, {{6}} nominal tagihan, {{7}} selisih ("kurang Rp50.000"). Tombol URL statis
 * "Periksa pembayaran" ke `{APP_URL}/pembayaran?status=perlu_review`.
 */
export const TEMPLATE_PERLU_REVIEW = {
  nama: "kostera_pembayaran_perlu_dicek",
  isi: "Perlu diperiksa — {{1}}\nPembayaran kamar {{2}} ({{3}}) periode {{4}}: diterima {{5}} dari tagihan {{6}} ({{7}}).\nStatus tidak diubah jadi Lunas sampai kamu memeriksanya.",
} as const;

/** Ke owner/admin saat tagihan Lunas lewat payment gateway; {{1}} kos … {{6}} cara bayar. */
export const TEMPLATE_PEMBAYARAN_MASUK = {
  nama: "kostera_pembayaran_masuk",
  isi: "Pembayaran masuk — {{1}}\nKamar {{2}} ({{3}}) membayar sewa periode {{4}} sebesar {{5}} lewat {{6}}. Tagihan otomatis Lunas dan bukti bayar dikirim ke penyewa.\nUangnya masuk ke saldo Xendit kos kamu (dipotong biaya transaksi Xendit).",
} as const;

/** Ganti variabel {{1}}, {{2}}, … dengan nilai berurutan. */
export const isiTemplate = (isi: string, variabel: string[]) =>
  isi.replace(/\{\{(\d+)\}\}/g, (_, n: string) => variabel[Number(n) - 1] ?? "");

const denganLink = (pesan: string, linkInvoice?: string) => (linkInvoice ? `${pesan}\n${linkInvoice}` : pesan);

const namaDepan = (inv: DataTagihan) => inv.namaPenghuni.split(" ")[0];

/** Variabel {{1}}–{{5}} template tagihan baru & pembayaran diterima. */
const variabelTagihan = (inv: DataTagihan, namaKos: string) => [
  namaDepan(inv),
  inv.nomorKamar,
  namaKos,
  formatPeriode(inv.periode),
  formatRupiah(inv.nominal),
];

/** Pesan tagihan baru untuk penyewa, berisi link invoice. */
export function pesanTagihan(inv: DataTagihan, namaKos: string, linkInvoice: string) {
  const variabel = [...variabelTagihan(inv, namaKos), formatTanggal(inv.jatuhTempo)];
  return denganLink(isiTemplate(TEMPLATE_TAGIHAN.isi, variabel), linkInvoice);
}

/** Template resmi yang isinya sama dengan pesanTagihan; tombol membuka invoice `tokenInvoice`. */
export function templateTagihan(inv: DataTagihan, namaKos: string, tokenInvoice: string): TemplateWhatsApp {
  const variabel = [...variabelTagihan(inv, namaKos), formatTanggal(inv.jatuhTempo)];
  return { nama: TEMPLATE_TAGIHAN.nama, bahasa: "id", variabel, tombolUrl: tokenInvoice };
}

/** Konfirmasi ke penyewa setelah pembayaran terverifikasi dan tagihan Lunas. */
export function pesanLunas(inv: DataTagihan, namaKos: string, linkInvoice: string) {
  return denganLink(isiTemplate(TEMPLATE_LUNAS.isi, variabelTagihan(inv, namaKos)), linkInvoice);
}

/** Template resmi yang isinya sama dengan pesanLunas; tombol membuka bukti bayar (invoice Lunas). */
export function templateLunas(inv: DataTagihan, namaKos: string, tokenInvoice: string): TemplateWhatsApp {
  return { nama: TEMPLATE_LUNAS.nama, bahasa: "id", variabel: variabelTagihan(inv, namaKos), tombolUrl: tokenInvoice };
}

/** Variabel {{1}}–{{6}} template pengingat; {{6}} = kapan jatuh tempo. */
function variabelPengingat(inv: DataTagihan, namaKos: string, kapan: string) {
  return [namaDepan(inv), namaKos, inv.nomorKamar, formatPeriode(inv.periode), formatRupiah(inv.nominal), kapan];
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

type DataTiket = { namaPenghuni: string; nomorTiket: string; jenis: string; nomorKamar: string; status: "diproses" | "selesai" };

const variabelTiket = (t: DataTiket, namaKos: string) => [
  t.namaPenghuni.split(" ")[0],
  t.nomorTiket,
  t.jenis.toLowerCase(),
  t.nomorKamar,
  namaKos,
  t.status === "diproses" ? "sedang ditangani" : "sudah selesai ditangani",
];

/** Kabar tiket untuk provider teks (WAHA, log), dengan link status tiket di baris terakhir. */
export function pesanTiket(t: DataTiket, namaKos: string, linkStatus: string) {
  return denganLink(isiTemplate(TEMPLATE_TIKET.isi, variabelTiket(t, namaKos)), linkStatus);
}

type DataPerluReview = {
  namaKos: string;
  nomorKamar: string;
  namaPenghuni: string;
  periode: string;
  nominal: number;
  diterima: number;
};

function variabelPerluReview(d: DataPerluReview) {
  const selisih = d.diterima - d.nominal;
  return [
    d.namaKos,
    d.nomorKamar,
    d.namaPenghuni,
    formatPeriode(d.periode),
    formatRupiah(d.diterima),
    formatRupiah(d.nominal),
    `${selisih < 0 ? "kurang" : "lebih"} ${formatRupiah(Math.abs(selisih))}`,
  ];
}

/** Notifikasi Perlu review untuk provider teks (WAHA, log) & riwayat chat, dengan link cek di baris terakhir. */
export function pesanPerluReview(d: DataPerluReview, linkCek: string) {
  return `${isiTemplate(TEMPLATE_PERLU_REVIEW.isi, variabelPerluReview(d))}\nCek: ${linkCek}`;
}

/** Template resmi yang isinya sama dengan pesanPerluReview; tombolnya URL statis (tanpa variabel). */
export function templatePerluReview(d: DataPerluReview): TemplateWhatsApp {
  return { nama: TEMPLATE_PERLU_REVIEW.nama, bahasa: "id", variabel: variabelPerluReview(d) };
}

/** Template resmi yang isinya sama dengan pesanTiket; tombol membuka status tiket lewat token invoice. */
export function templateTiket(t: DataTiket, namaKos: string, tokenInvoice: string): TemplateWhatsApp {
  return { nama: TEMPLATE_TIKET.nama, bahasa: "id", variabel: variabelTiket(t, namaKos), tombolUrl: `${tokenInvoice}/tiket/status` };
}

type DataPembayaranMasuk = {
  namaKos: string;
  nomorKamar: string;
  namaPenghuni: string;
  periode: string;
  nominal: number;
  metode: string;
};

const variabelPembayaranMasuk = (d: DataPembayaranMasuk) => [
  d.namaKos,
  d.nomorKamar,
  d.namaPenghuni,
  formatPeriode(d.periode),
  formatRupiah(d.nominal),
  d.metode,
];

/** Kabar uang masuk untuk provider teks (WAHA, log) & riwayat chat, dengan link di baris terakhir. */
export function pesanPembayaranMasuk(d: DataPembayaranMasuk, link: string) {
  return `${isiTemplate(TEMPLATE_PEMBAYARAN_MASUK.isi, variabelPembayaranMasuk(d))}\nLihat: ${link}`;
}

/** Template resmi yang isinya sama dengan pesanPembayaranMasuk; tombolnya URL statis. */
export function templatePembayaranMasuk(d: DataPembayaranMasuk): TemplateWhatsApp {
  return { nama: TEMPLATE_PEMBAYARAN_MASUK.nama, bahasa: "id", variabel: variabelPembayaranMasuk(d) };
}
