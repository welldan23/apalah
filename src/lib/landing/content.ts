// Konten landing page Kostera (copy + data tiruan untuk mockup chat Kosta).
// Angka di mockup mengikuti data contoh Kos Melati yang sama dengan dashboard.

import {
  BedDouble,
  CalendarClock,
  ClipboardList,
  FilePlus2,
  MessageCircleMore,
  Send,
  ShieldCheck,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

import type { InvoiceStatus } from "@/lib/types";

export const HERO = {
  eyebrow: "Asisten kos di WhatsApp untuk owner & admin",
  judul: "Tagihan kos rapi, pembayaran lebih pasti",
  deskripsi:
    "Cukup chat Kosta AI di WhatsApp: cek tunggakan, siapkan tagihan, dan kirim pengingat. Setiap aksi baru jalan setelah kamu balas kodenya. Dashboard Kostera merangkum semuanya kalau mau dilihat sekaligus.",
  ctaUtama: "Mulai gratis",
  ctaKedua: "Lihat cara kerja",
  poin: [
    "Urusan harian cukup lewat chat WhatsApp",
    "Aksi baru jalan setelah kamu balas kode",
    "Lunas otomatis dari pembayaran terverifikasi",
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
      /** Instruksi di bawah preview, sama dengan balasan WhatsApp sungguhan. */
      catatan: string;
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

/**
 * Percakapan contoh owner Kos Melati dengan Kosta AI di WhatsApp. Teksnya mengikuti balasan
 * sungguhan: aksi baru jalan setelah owner membalas "YA" + kode aksi, dan status bayar dijawab
 * saat ditanya (notifikasi Lunas dikirim ke penyewa, bukan ke owner).
 */
export const CHAT_KOSTA: PesanChat[] = [
  { dari: "owner", teks: "Kosta AI, berapa tunggakan bulan ini?", waktu: "08.02" },
  {
    dari: "kosta",
    teks: "Ada 3 tagihan yang sudah lewat jatuh tempo, total Rp1.950.000: A05 Rizky, B06 Reza, C05 Nadia.",
    waktu: "08.02",
  },
  { dari: "owner", teks: "Siapkan reminder buat mereka", waktu: "08.03" },
  {
    dari: "kosta",
    jenis: "preview",
    judul: "Preview pengingat · Kos Melati",
    baris: [
      ["Penerima", "3 penyewa"],
      ["Periode", "September 2026"],
      ["Total", "Rp1.950.000"],
    ],
    catatan: "Belum ada yang dikirim. Balas “YA\u00a0482913” untuk mengirim, atau “BATAL\u00a0482913”. Berlaku 24 jam.",
    waktu: "08.03",
  },
  { dari: "owner", teks: "YA 482913", waktu: "08.04" },
  {
    dari: "kosta",
    jenis: "invoice",
    teks: "Pengingat terkirim ke 3 penyewa, lengkap dengan link invoice masing-masing.",
    link: "Invoice B06 · Rp650.000",
    waktu: "08.04",
  },
  { dari: "owner", teks: "B06 sudah bayar belum?", waktu: "10.20" },
  {
    dari: "kosta",
    jenis: "lunas",
    teks: "Sudah. Tagihan B06 (Reza Kurniawan) September 2026 sebesar Rp650.000 lunas, dibayar 24 Sep 2026.",
    nominal: "Rp650.000",
    waktu: "10.20",
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
      "Tagihan terbit terjadwal, atau cukup minta Kosta AI lewat chat",
      "Status Lunas berubah sendiri saat dana benar-benar masuk",
      "Kosta AI di WhatsApp menyiapkan pengingat, kamu cukup balas kodenya",
      "Tanya “kamar mana yang kosong?” ke Kosta AI, langsung dijawab",
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
      "Chat “buat tagihan bulan depan” ke Kosta AI, atau atur sekali di dashboard supaya terbit otomatis tiap bulan.",
    ilustrasi: "jadwal",
  },
  {
    icon: ShieldCheck,
    judul: "Pantau pembayaran",
    deskripsi:
      "Tanya “B06 sudah bayar?” kapan saja. Lunas hanya saat pembayaran terverifikasi; nominal yang tidak cocok ditandai Perlu Review.",
    ilustrasi: "status",
  },
  {
    icon: BedDouble,
    judul: "Kamar rapi",
    deskripsi:
      "Cukup chat “B04 pindah ke B05” atau “A05 keluar hari ini”. Kosta AI siapkan preview, kamu konfirmasi pakai kode.",
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
    judul: "Daftar & catat kamar",
    deskripsi:
      "Daftar pakai nomor WhatsApp, isi nama kos dan kamar, lalu catat penghuni beserta harga sewanya. Cukup sekali di awal.",
    hasil: "Nomor WA-mu langsung tertaut ke Kosta AI",
  },
  {
    icon: MessageCircleMore,
    judul: "Chat Kosta AI di WhatsApp",
    deskripsi:
      "Tanya tunggakan, minta buat tagihan, atau siapkan pengingat. Angkanya diambil langsung dari data kos kamu.",
    hasil: "Preview jelas: penerima, periode, dan nominal",
  },
  {
    icon: ShieldCheck,
    judul: "Balas kode untuk menjalankan",
    deskripsi:
      "Setelah cek preview, balas “YA” beserta kodenya. Baru saat itu pesan terkirim atau data berubah.",
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
    tanya: "Apa bedanya Kostera dan Kosta AI?",
    jawab:
      "Kostera adalah platformnya: dashboard, tagihan, dan pemantauan pembayaran. Kosta AI adalah asisten di WhatsApp yang ada di dalam Kostera, supaya kamu bisa mengurus kos cukup lewat chat.",
  },
  {
    tanya: "Bagaimana cara daftarnya?",
    jawab:
      "Cukup pakai nomor WhatsApp dan kode OTP. Ruang kerja kos kamu langsung dibuat, dan nomor WA-mu otomatis tertaut ke Kosta AI.",
  },
  {
    tanya: "Apakah harus buka dashboard setiap hari?",
    jawab:
      "Tidak. Urusan harian cukup lewat chat WhatsApp dengan Kosta AI. Dashboard berguna untuk melihat semuanya sekaligus atau mengatur jadwal tagihan dan pengingat.",
  },
  {
    tanya: "Apakah Kosta AI bisa mengirim pesan tanpa persetujuan saya?",
    jawab:
      "Tidak. Setiap aksi yang mengubah data atau mengirim pesan ke penyewa selalu menampilkan preview berisi penerima, periode, dan nominal dulu. Aksi baru jalan setelah kamu balas “YA” beserta kode aksinya, dan preview hangus setelah 24 jam.",
  },
  {
    tanya: "Dari mana angka tunggakan dan pemasukan berasal?",
    jawab:
      "Semua angka diambil langsung dari database tagihan dan pembayaran kamu, bukan dikarang AI. Kosta AI hanya membantu membaca pertanyaanmu dan menulis balasan singkat.",
  },
  {
    tanya: "Kapan status tagihan berubah jadi Lunas?",
    jawab:
      "Hanya saat pembayaran terverifikasi dari payment gateway. Kosta AI tidak bisa menandai lunas dari chat atau bukti transfer. Kalau nominal yang dibayar tidak cocok, tagihan ditandai Perlu Review supaya kamu cek dulu.",
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
    "Isi nama kos, jumlah kamar, dan nomor WhatsApp. Setelah itu kamu langsung bisa chat Kosta AI.",
  tombol: "Daftarkan kos",
};

export const CTA_PENUTUP: Cta = {
  judul: "Rapikan tagihan kos mulai bulan ini",
  deskripsi: "Daftar pakai nomor WhatsApp, tambahkan kamar, lalu urus tagihan cukup lewat chat Kosta AI.",
  tombol: "Mulai gratis",
};
