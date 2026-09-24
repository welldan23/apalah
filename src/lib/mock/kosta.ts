// Data tiruan (stub) percakapan owner Kos Melati dengan Kosta — tahap frontend.
// Angka mengikuti data contoh Kos Melati. Diganti riwayat wa_messages saat backend dibangun.

import type { PesanKosta } from "@/lib/types";

const pada = (jam: string) => `2026-09-24T${jam}:00+07:00`;

export const mockPercakapanKosta: PesanKosta[] = [
  { id: "m1", dari: "owner", waktu: pada("08:02"), teks: "Kosta, berapa tunggakan bulan ini?" },
  {
    id: "m2",
    dari: "kosta",
    waktu: pada("08:02"),
    teks: "Ada 3 tagihan jatuh tempo, total Rp1.950.000:\n• A05 Rizky — Rp500.000, lewat 9 hari\n• B06 Reza — Rp650.000, lewat 6 hari\n• C05 Nadia — Rp800.000, lewat 4 hari",
  },
  { id: "m3", dari: "owner", waktu: pada("08:05"), teks: "Kamar mana yang masih kosong?" },
  {
    id: "m4",
    dari: "kosta",
    waktu: pada("08:05"),
    teks: "6 kamar masih kosong: A07, A11 (Standar), B05, B13 (KM Dalam), C03, C10 (AC).",
  },
  { id: "m5", dari: "owner", waktu: pada("08:07"), teks: "Rekap pemasukan bulan ini" },
  {
    id: "m6",
    dari: "kosta",
    waktu: pada("08:07"),
    teks: "Pemasukan September 2026: Rp12.500.000 dari 19 pembayaran terverifikasi. Masih menunggu 12 tagihan (Rp7.650.000) dan 3 jatuh tempo (Rp1.950.000).",
  },
];
