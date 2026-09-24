// Data tiruan (stub) percakapan owner Kos Melati dengan Kosta — tahap frontend.
// Angka mengikuti data contoh Kos Melati. Diganti riwayat wa_messages saat backend dibangun.

import type { PesanKosta, WorkspaceRingkas } from "@/lib/types";

const pada = (jam: string, tanggal = "2026-09-24") => `${tanggal}T${jam}:00+07:00`;

export const mockPercakapanKosta: PesanKosta[] = [
  {
    id: "h1",
    dari: "owner",
    waktu: pada("09:15", "2026-09-20"),
    teks: "Rekap pemasukan minggu ini",
  },
  {
    id: "h2",
    dari: "kosta",
    waktu: pada("09:15", "2026-09-20"),
    teks: "Pembayaran terverifikasi 14–20 September:",
    lampiran: {
      jenis: "rekap",
      judul: "Masuk 14–20 Sep 2026",
      baris: [
        { label: "C07 · Kadek Sri Wahyuni", nominal: 800_000, catatan: "14 Sep" },
        { label: "B10 · Arif Hidayat", nominal: 650_000, catatan: "16 Sep" },
        { label: "B11 · Rina Marlina", nominal: 650_000, catatan: "18 Sep" },
        { label: "B12 · Kevin Wijaya", nominal: 650_000, catatan: "20 Sep" },
      ],
    },
  },
  {
    id: "h3",
    dari: "owner",
    waktu: pada("19:30", "2026-09-22"),
    teks: "Kamar A03 sudah bayar belum?",
  },
  {
    id: "h4",
    dari: "kosta",
    waktu: pada("19:30", "2026-09-22"),
    teks: "Belum. Tagihan A03 (Yoga Saputra) Rp500.000 masih menunggu pembayaran, jatuh tempo 26 Sep.",
  },
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
        { label: "Menunggu", nominal: 6_850_000, catatan: "11 tagihan" },
        { label: "Jatuh tempo", nominal: 1_950_000, catatan: "3 tagihan" },
        { label: "Perlu review", nominal: 800_000, catatan: "1 tagihan · nominal bayar belum cocok" },
      ],
    },
  },
  { id: "m7", dari: "owner", waktu: pada("08:10"), teks: "Siapkan reminder buat yang menunggak" },
  {
    id: "m8",
    dari: "kosta",
    waktu: pada("08:10"),
    teks: "Ini preview pengingatnya. Belum ada pesan yang dikirim sampai kamu konfirmasi.",
    lampiran: {
      jenis: "preview_aksi",
      aksi: "reminder",
      periode: "2026-09",
      penerima: [
        { nomorKamar: "A05", nama: "Rizky Ramadhan", nominal: 500_000 },
        { nomorKamar: "B06", nama: "Reza Kurniawan", nominal: 650_000 },
        { nomorKamar: "C05", nama: "Nadia Safitri", nominal: 800_000 },
      ],
      total: 1_950_000,
      status: "menunggu_konfirmasi",
    },
  },
];

/** Pemilik Griya Asri; owner contoh menjadi admin di sana. */
export const mockPemilikLain = { id: "usr_pemilik_griya", nama: "Hendra Wijaya", nomorWa: "6281377009900" };

/** Kos lain yang dikelola owner contoh — untuk mencoba pemilih workspace multi-kos. */
export const mockWorkspaceLain: WorkspaceRingkas[] = [
  { id: "org_kos_mawar", namaKos: "Kos Mawar", jumlahKamar: 12, peran: "owner" },
  { id: "org_griya_asri", namaKos: "Griya Asri", jumlahKamar: 20, peran: "admin" },
];
