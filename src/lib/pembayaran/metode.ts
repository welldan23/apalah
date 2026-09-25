// Metode bayar lewat tautan invoice (payment gateway): QRIS atau transfer Virtual Account.
// Fungsi murni — dipakai halaman bayar penyewa dan endpoint pembuat transaksi.

import type { InvoiceStatus } from "@/lib/types";

export type IdMetodeBayar = "qris" | "va_bca" | "va_bni" | "va_bri" | "va_mandiri" | "va_permata";

export type MetodeBayar = {
  id: IdMetodeBayar;
  jenis: "qris" | "va";
  label: string;
  keterangan: string;
  /** Batas waktu bayar sejak instruksi dibuat. */
  masaBerlakuMenit: number;
};

const va = (id: IdMetodeBayar, bank: string): MetodeBayar => ({
  id,
  jenis: "va",
  label: `Virtual Account ${bank}`,
  keterangan: `Transfer lewat m-banking, internet banking, atau ATM ${bank}.`,
  masaBerlakuMenit: 24 * 60,
});

export const METODE_BAYAR: MetodeBayar[] = [
  {
    id: "qris",
    jenis: "qris",
    label: "QRIS",
    keterangan: "Scan pakai GoPay, OVO, DANA, ShopeePay, atau m-banking apa pun.",
    masaBerlakuMenit: 15,
  },
  va("va_bca", "BCA"),
  va("va_bni", "BNI"),
  va("va_bri", "BRI"),
  va("va_mandiri", "Mandiri"),
  va("va_permata", "Permata"),
];

export const cariMetode = (id: string) => METODE_BAYAR.find((m) => m.id === id);

/** Instruksi bayar untuk satu transaksi (kontrak endpoint pembuat transaksi). */
export type InstruksiBayar = {
  metode: IdMetodeBayar;
  nominal: number;
  /** ISO datetime batas bayar. */
  kedaluwarsaPada: string;
  /** Untuk VA. */
  nomorVa?: string;
  /** VA yang dibayar lewat menu Multipayment (Mandiri): kode perusahaan yang dimasukkan dulu. */
  kodePerusahaan?: string;
  /** Untuk QRIS: isi QR dari gateway. */
  qrString?: string;
};

/** Yang masih harus dibayar: tagihan dikurangi uang yang sudah masuk (tidak pernah negatif). */
export const sisaTagihan = (nominal: number, sudahDiterima: number) => Math.max(nominal - sudahDiterima, 0);

/**
 * Boleh dibuatkan transaksi bayar: ada sisa dan tagihannya sudah dikirim (bukan draf yang
 * nominalnya masih bisa dikoreksi, bukan yang sudah Lunas).
 */
export const tagihanBisaDibayar = (status: InvoiceStatus, sisa: number) => sisa > 0 && status !== "draft" && status !== "lunas";

/** "880812345678" → "8808 1234 5678" (mudah dibaca & diketik ulang). */
export const formatNomorVa = (nomor: string) => nomor.replace(/\D/g, "").replace(/(\d{4})(?=\d)/g, "$1 ");

/** Sisa waktu "14:59" (di bawah 1 jam) atau "23 jam 59 menit"; "0:00" bila lewat. */
export function formatSisaWaktu(ms: number) {
  const detik = Math.max(Math.floor(ms / 1000), 0);
  if (detik >= 3600) return `${Math.floor(detik / 3600)} jam ${Math.floor((detik % 3600) / 60)} menit`;
  return `${Math.floor(detik / 60)}:${String(detik % 60).padStart(2, "0")}`;
}

/** Langkah bayar singkat untuk penyewa. */
export function langkahBayar(metode: MetodeBayar, nominal: string, kodePerusahaan?: string) {
  if (metode.jenis === "qris") {
    return [
      "Buka aplikasi e-wallet atau m-banking, lalu pilih Scan/QRIS.",
      "Scan kode QR di atas (atau simpan gambarnya lalu unggah dari galeri).",
      `Pastikan nominal ${nominal} dan penerima sesuai, lalu bayar.`,
    ];
  }
  const bank = metode.label.replace("Virtual Account ", "");
  if (kodePerusahaan) {
    return [
      `Buka m-banking/ATM ${bank}, pilih Bayar → Multipayment.`,
      `Masukkan kode perusahaan ${kodePerusahaan}, lalu nomor Virtual Account di atas sebagai kode bayar.`,
      `Pastikan nominal ${nominal} dan nama tagihan sesuai, lalu selesaikan pembayaran.`,
    ];
  }
  return [
    `Buka m-banking/ATM ${bank}, pilih Transfer → Virtual Account.`,
    "Masukkan nomor Virtual Account di atas.",
    `Pastikan nominal ${nominal} dan nama tagihan sesuai, lalu selesaikan pembayaran.`,
  ];
}
