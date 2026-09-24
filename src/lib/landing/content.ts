// Konten landing page Kostera (copy + data tiruan untuk mockup chat Kosta).
// Angka di mockup mengikuti data contoh Kos Melati yang sama dengan dashboard.

import {
  BedDouble,
  CalendarClock,
  ClipboardList,
  FilePlus2,
  Send,
  ShieldCheck,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

import type { InvoiceStatus } from "@/lib/types";

export const HERO = {
  eyebrow: "Untuk owner & admin kos",
  judul: "Tagihan kos rapi, pembayaran lebih pasti",
  deskripsi:
    "Kostera merapikan tagihan, pembayaran, dan kamar dalam satu tempat. Kosta, asisten AI di WhatsApp, bantu cek tunggakan dan siapkan pengingat. Kamu tinggal konfirmasi.",
  ctaUtama: "Mulai gratis",
  ctaKedua: "Lihat cara kerja",
  poin: [
    "Masuk cukup pakai nomor WhatsApp",
    "Lunas otomatis dari pembayaran terverifikasi",
    "Kirim massal selalu lewat preview",
  ],
};

/** Cuplikan Dashboard Kos di hero (data tiruan Kos Melati). */
export const INTIP_DASHBOARD = {
  judul: "Dashboard Kos Melati",
  periode: "September 2026",
  metrik: [
    ["Terisi", "34/40"],
    ["Perlu ditagih", "3"],
    ["Masuk", "Rp12,5jt"],
  ] as [string, string][],
  persenTerkumpul: 57,
};

export type PesanChat =
  | { dari: "owner"; teks: string; waktu: string }
  | { dari: "kosta"; teks: string; waktu: string }
  | {
      dari: "kosta";
      jenis: "preview";
      judul: string;
      baris: [string, string][];
      waktu: string;
    }
  | {
      dari: "kosta";
      jenis: "invoice";
      teks: string;
      link: string;
      waktu: string;
    }
  | {
      dari: "kosta";
      jenis: "lunas";
      teks: string;
      nominal: string;
      waktu: string;
    };

/** Percakapan contoh owner Kos Melati dengan Kosta di WhatsApp. */
export const CHAT_KOSTA: PesanChat[] = [
  { dari: "owner", teks: "Kosta, berapa tunggakan bulan ini?", waktu: "08.02" },
  {
    dari: "kosta",
    teks: "Ada 3 tagihan jatuh tempo, total Rp1.950.000. Paling lama: kamar A05 (Rizky), jatuh tempo 15 Sep.",
    waktu: "08.02",
  },
  { dari: "owner", teks: "Siapkan reminder buat mereka", waktu: "08.03" },
  {
    dari: "kosta",
    jenis: "preview",
    judul: "Preview reminder",
    baris: [
      ["Penerima", "3 penyewa"],
      ["Periode", "September 2026"],
      ["Total", "Rp1.950.000"],
    ],
    waktu: "08.03",
  },
  { dari: "owner", teks: "Kirim", waktu: "08.04" },
  {
    dari: "kosta",
    jenis: "invoice",
    teks: "Terkirim ke 3 penyewa, lengkap dengan link invoice masing-masing.",
    link: "Invoice B06 · Rp650.000",
    waktu: "08.04",
  },
  {
    dari: "kosta",
    jenis: "lunas",
    teks: "Pembayaran masuk dari Reza (B06). Status tagihan: Lunas.",
    nominal: "Rp650.000",
    waktu: "10.17",
  },
];

export const MASALAH = {
  judul: "Dari chat berantakan ke tagihan yang rapi",
  sebelum: {
    label: "Tanpa Kostera",
    poin: [
      "Tagihan diketik manual satu per satu tiap bulan",
      "Bolak-balik cek mutasi rekening untuk tahu siapa yang sudah bayar",
      "Penyewa yang menunggak gampang terlewat diingatkan",
      "Kamar kosong baru ketahuan setelah lama tidak terisi",
    ],
  },
  sesudah: {
    label: "Dengan Kostera",
    poin: [
      "Tagihan terbit terjadwal, nominal dan jatuh tempo sudah pasti",
      "Status Lunas berubah sendiri saat dana benar-benar masuk",
      "Kosta menyiapkan pengingat, kamu cukup cek dan konfirmasi",
      "Kamar terisi dan kosong terlihat dalam satu layar",
    ],
  },
};

export type Benefit = {
  icon: LucideIcon;
  judul: string;
  deskripsi: string;
  ilustrasi: "jadwal" | "status" | "kamar";
};

export const BENEFIT: Benefit[] = [
  {
    icon: CalendarClock,
    judul: "Tagihan terjadwal",
    deskripsi:
      "Buat tagihan untuk satu atau banyak kamar sekaligus, lalu biarkan terbit otomatis tiap bulan.",
    ilustrasi: "jadwal",
  },
  {
    icon: ShieldCheck,
    judul: "Pantau pembayaran",
    deskripsi:
      "Lunas hanya saat pembayaran terverifikasi. Nominal yang tidak cocok ditandai Perlu Review.",
    ilustrasi: "status",
  },
  {
    icon: BedDouble,
    judul: "Kamar rapi",
    deskripsi:
      "Catat penghuni, pindah kamar, atau keluar dengan beberapa ketukan. Kamar kosong langsung kelihatan.",
    ilustrasi: "kamar",
  },
];

export type Langkah = {
  icon: LucideIcon;
  judul: string;
  deskripsi: string;
  /** Hasil nyata setelah langkah ini selesai. */
  hasil: string;
};

export const CARA_KERJA: Langkah[] = [
  {
    icon: ClipboardList,
    judul: "Tambah kos, kamar & penghuni",
    deskripsi: "Isi nama kos dan jumlah kamar, lalu catat penghuni beserta harga sewanya.",
    hasil: "Kamar terisi & kosong langsung terpantau",
  },
  {
    icon: FilePlus2,
    judul: "Buat tagihan",
    deskripsi:
      "Pilih kamar, nominal, dan jatuh tempo. Setiap tagihan punya link invoice untuk penyewa.",
    hasil: "Link invoice siap dibagikan ke penyewa",
  },
  {
    icon: ShieldCheck,
    judul: "Pantau & ingatkan",
    deskripsi:
      "Lihat siapa yang sudah bayar, lalu kirim pengingat lewat Kosta setelah kamu cek preview-nya.",
    hasil: "Status Lunas berubah otomatis saat dana masuk",
  },
];

export type BarisPreview = {
  kamar: string;
  nama: string;
  nominal: number;
  status: InvoiceStatus;
  /** Keterangan waktu seperti di tabel status bayar dashboard. */
  keterangan: string;
};

/** Preview Dashboard Kos di landing — data contoh Kos Melati, bukan data kos mana pun. */
export const PREVIEW_DASHBOARD = {
  judul: "Kondisi kos kelihatan dalam satu layar",
  deskripsi:
    "Begitu masuk, kamu langsung tahu kamar mana yang kosong, siapa yang perlu ditagih, dan berapa uang yang sudah masuk bulan ini.",
  sorotan: [
    "Kamar terisi dan kosong dalam satu pandangan",
    "Tagihan jatuh tempo selalu di urutan teratas",
    "Uang masuk bulan ini terhitung sendiri",
    "Buat tagihan, tambah penghuni, atau kirim reminder dari layar yang sama",
  ],
  alamat: "kostera.id/dashboard",
  sapaan: "Halo, Ratna",
  namaKos: "Kos Melati",
  periode: "Periode September 2026",
  metrik: [
    { label: "Total kamar", nilai: "40", catatan: "6 masih kosong" },
    { label: "Terisi", nilai: "34", catatan: "85% hunian" },
    { label: "Perlu ditagih", nilai: "3", catatan: "Rp1,95jt jatuh tempo" },
    { label: "Masuk bulan ini", nilai: "Rp12,5jt", catatan: "19 dari 34 lunas" },
  ],
  aksi: [
    { label: "Buat tagihan", icon: FilePlus2 },
    { label: "Tambah penghuni", icon: UserPlus },
    { label: "Kirim reminder", icon: Send },
  ] as { label: string; icon: LucideIcon }[],
  jumlahTagihan: "34 tagihan",
  // Urut seperti tabel dashboard: yang perlu ditindak dulu.
  statusBayar: [
    {
      kamar: "A05",
      nama: "Rizky Ramadhan",
      nominal: 500_000,
      status: "jatuh_tempo",
      keterangan: "Lewat 9 hari",
    },
    {
      kamar: "B06",
      nama: "Reza Kurniawan",
      nominal: 650_000,
      status: "jatuh_tempo",
      keterangan: "Lewat 6 hari",
    },
    {
      kamar: "C05",
      nama: "Nadia Safitri",
      nominal: 800_000,
      status: "jatuh_tempo",
      keterangan: "Lewat 4 hari",
    },
    {
      kamar: "A03",
      nama: "Yoga Saputra",
      nominal: 500_000,
      status: "menunggu",
      keterangan: "2 hari lagi",
    },
    {
      kamar: "B12",
      nama: "Kevin Wijaya",
      nominal: 650_000,
      status: "lunas",
      keterangan: "Dibayar 20 Sep",
    },
  ] as BarisPreview[],
};

export const FAQ: { tanya: string; jawab: string }[] = [
  {
    tanya: "Apa bedanya Kostera dan Kosta?",
    jawab:
      "Kostera adalah platformnya: dashboard, tagihan, dan pemantauan pembayaran. Kosta adalah asisten AI di WhatsApp yang ada di dalam Kostera, supaya kamu bisa mengurus kos cukup lewat chat.",
  },
  {
    tanya: "Bagaimana cara daftarnya?",
    jawab:
      "Cukup pakai nomor WhatsApp dan kode OTP. Ruang kerja kos kamu langsung dibuat, dan nomor WA-mu otomatis tertaut ke Kosta.",
  },
  {
    tanya: "Apakah Kosta bisa mengirim pesan tanpa persetujuan saya?",
    jawab:
      "Tidak. Setiap aksi yang mengubah data atau mengirim pesan ke banyak penyewa selalu menampilkan preview berisi penerima, periode, dan nominal dulu. Pesan baru terkirim setelah kamu konfirmasi.",
  },
  {
    tanya: "Dari mana angka tunggakan dan pemasukan berasal?",
    jawab:
      "Semua angka diambil langsung dari database tagihan dan pembayaran kamu, bukan dikarang AI. Kosta hanya membantu membaca pertanyaanmu dan menulis balasan singkat.",
  },
  {
    tanya: "Kapan status tagihan berubah jadi Lunas?",
    jawab:
      "Hanya saat pembayaran terverifikasi dari payment gateway. Kalau nominal yang dibayar tidak cocok, tagihan ditandai Perlu Review supaya kamu cek dulu.",
  },
  {
    tanya: "Apakah penyewa bisa melihat data penyewa lain?",
    jawab:
      "Tidak. Penyewa hanya bisa membuka tagihannya sendiri lewat link invoice. Data setiap kos juga terpisah dari kos lain.",
  },
];

export type Cta = { judul: string; deskripsi: string; tombol: string };

/** CTA di tengah halaman, setelah cara kerja. */
export const CTA_TENGAH: Cta = {
  judul: "Daftarkan kos kamu, gratis",
  deskripsi:
    "Isi nama kos, jumlah kamar, dan nomor WhatsApp. Ruang kerja kos langsung siap tanpa langkah teknis.",
  tombol: "Daftarkan kos",
};

export const CTA_PENUTUP: Cta = {
  judul: "Rapikan tagihan kos mulai bulan ini",
  deskripsi: "Daftar pakai nomor WhatsApp, tambahkan kamar, dan kirim tagihan pertamamu hari ini.",
  tombol: "Mulai gratis",
};
