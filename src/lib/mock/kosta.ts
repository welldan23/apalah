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
    teks: "Ada 3 tagihan yang sudah lewat jatuh tempo bulan ini.",
    lampiran: {
      jenis: "daftar_tagihan",
      judul: "Tunggakan September 2026",
      baris: [
        { nomorKamar: "A05", nama: "Rizky Ramadhan", nominal: 500_000, keterangan: "lewat 9 hari" },
        { nomorKamar: "B06", nama: "Reza Kurniawan", nominal: 650_000, keterangan: "lewat 6 hari" },
        { nomorKamar: "C05", nama: "Nadia Safitri", nominal: 800_000, keterangan: "lewat 4 hari" },
      ],
      total: 1_950_000,
    },
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
    teks: "Ini rekap pemasukan bulan berjalan, dihitung dari pembayaran yang sudah terverifikasi.",
    lampiran: {
      jenis: "rekap",
      judul: "Pemasukan September 2026",
      baris: [
        { label: "Sudah masuk", nominal: 12_500_000, catatan: "19 pembayaran" },
        { label: "Menunggu", nominal: 7_650_000, catatan: "12 tagihan" },
        { label: "Jatuh tempo", nominal: 1_950_000, catatan: "3 tagihan" },
      ],
    },
  },
];
