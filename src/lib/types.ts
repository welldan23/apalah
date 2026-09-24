// Tipe domain Kostera — mengikuti skema database di PRD (kolom snake_case → camelCase).
// Semua nominal dalam rupiah (integer), tanggal dalam format ISO "YYYY-MM-DD".

export type Organization = {
  id: string;
  namaKos: string;
  alamat: string;
  jumlahKamar: number;
};

export type Owner = {
  id: string;
  nama: string;
  nomorWa: string;
};

export type RoomStatus = "terisi" | "kosong";

export type Room = {
  id: string;
  organizationId: string;
  nomorKamar: string;
  tipe: string;
  hargaSewa: number;
  status: RoomStatus;
};

export type TenantStatus = "aktif" | "keluar";

export type Tenant = {
  id: string;
  organizationId: string;
  nama: string;
  nomorWa: string;
  roomId: string;
  tanggalMasuk: string;
  tanggalKeluar?: string;
  status: TenantStatus;
  hargaSewa: number;
};

export type InvoiceStatus =
  | "draft"
  | "terkirim"
  | "menunggu"
  | "lunas"
  | "jatuh_tempo"
  | "perlu_review";

export type Invoice = {
  id: string;
  organizationId: string;
  tenantId: string;
  roomId: string;
  /** Format YYYY-MM */
  periode: string;
  nominal: number;
  jatuhTempo: string;
  status: InvoiceStatus;
  tokenPublik: string;
  diterbitkanPada: string;
  dibayarPada?: string;
};

export type PaymentStatus = "pending" | "valid" | "tidak_cocok";

export type Payment = {
  id: string;
  invoiceId: string;
  nominalDibayar: number;
  metode: string;
  provider: string;
  referensiProvider: string;
  status: PaymentStatus;
  /** Waktu verifikasi webhook gateway, ISO datetime. */
  diverifikasiPada: string;
};

/** Pembayaran masuk untuk ditampilkan di rekap: + nama penghuni & nomor kamar. */
export type PaymentRow = Pick<
  Payment,
  "id" | "invoiceId" | "nominalDibayar" | "metode" | "diverifikasiPada"
> & {
  namaPenghuni: string;
  nomorKamar: string;
};

/** Baris tabel status bayar: invoice + nama penghuni & nomor kamar. */
export type InvoiceRow = Invoice & {
  namaPenghuni: string;
  nomorKamar: string;
};

export type RoomTypeSummary = {
  tipe: string;
  hargaSewa: number;
  total: number;
  terisi: number;
};

/** Satu kamar di peta kamar dashboard. */
export type RoomCell = {
  id: string;
  nomorKamar: string;
  tipe: string;
  hargaSewa: number;
  status: RoomStatus;
  /** Nama penghuni aktif, kosong bila kamar belum terisi. */
  namaPenghuni?: string;
  /** Harga sewa yang disepakati penghuni aktif (bisa beda dari harga kamar). */
  hargaSewaPenghuni?: number;
};

/** Jumlah invoice + total nominalnya. */
export type RekapTagihan = {
  jumlah: number;
  nominal: number;
};

export type RingkasanKamar = {
  total: number;
  terisi: number;
  kosong: number;
  perTipe: RoomTypeSummary[];
  /** Semua kamar, urut nomor kamar. */
  daftar: RoomCell[];
};

/** Ringkasan Kos & Kamar satu organisasi (endpoint GET /api/dashboard/ringkasan). */
export type RingkasanKos = {
  organization: Organization;
  kamar: RingkasanKamar;
};

export type RekapTagihanPerStatus = {
  total: RekapTagihan;
  lunas: RekapTagihan;
  menunggu: RekapTagihan;
  jatuhTempo: RekapTagihan;
  perluReview: RekapTagihan;
};

export type Pemasukan = {
  /** Total pembayaran valid yang masuk di periode berjalan. */
  bulanIni: number;
  /** Jumlah pembayaran valid di periode berjalan. */
  jumlahPembayaran: number;
  /** Pembayaran valid terbaru, paling baru di atas. */
  terakhir: PaymentRow[];
};

/** Rekap pemasukan satu periode (endpoint GET /api/dashboard/pemasukan). */
export type RekapPemasukan = {
  tagihan: RekapTagihanPerStatus;
  pemasukan: Pemasukan;
};

export type DashboardData = {
  organization: Organization;
  owner: Owner;
  /** Hari ini menurut server, format YYYY-MM-DD. */
  hariIni: string;
  /** Periode berjalan, format YYYY-MM. */
  periode: string;
  kamar: RingkasanKamar;
  /** Rekap invoice periode berjalan per status. */
  tagihan: RekapTagihanPerStatus;
  pemasukan: Pemasukan;
  /** Invoice periode berjalan, urut dari yang paling perlu ditindak. */
  invoices: InvoiceRow[];
  /** Tagihan dengan pembayaran tidak cocok (semua periode) — untuk banner notifikasi. */
  perluReview: PembayaranPerluReview[];
};

/** Tagihan berstatus Perlu Review beserta uang yang sudah diterima gateway (tanpa pending). */
export type PembayaranPerluReview = {
  invoiceId: string;
  nomorKamar: string;
  namaPenghuni: string;
  periode: string;
  nominal: number;
  dibayar: number;
};

/**
 * Data terstruktur di jawaban Kosta. Nominal selalu angka dari database (bukan teks
 * buatan AI) dan baru diformat Rupiah saat ditampilkan.
 */
export type LampiranKosta =
  | {
      jenis: "daftar_tagihan";
      judul: string;
      baris: { nomorKamar: string; nama: string; nominal: number; keterangan: string }[];
      total: number;
    }
  | {
      jenis: "rekap";
      judul: string;
      baris: { label: string; nominal: number; catatan?: string }[];
    }
  | ({ jenis: "preview_aksi" } & PreviewAksi);

/** Status draft aksi Kosta (tabel action_drafts). */
export type StatusDraftAksi = "menunggu_konfirmasi" | "disetujui" | "dibatalkan" | "dijalankan";

/** Preview aksi yang mengubah data / kirim massal — wajib dikonfirmasi owner dulu. */
export type PreviewAksi = {
  aksi: "reminder" | "tagihan";
  /** Periode tagihan, YYYY-MM. */
  periode: string;
  penerima: { nomorKamar: string; nama: string; nominal: number }[];
  total: number;
  status: StatusDraftAksi;
  /** ID action_drafts — ada bila preview berasal dari server. */
  draftId?: string;
};

/** Isi action_drafts.ringkasan_preview: preview untuk owner + target yang dijalankan setelah disetujui. */
export type DataDraftAksi = Omit<PreviewAksi, "status" | "draftId"> & {
  /** Aksi reminder: tagihan jatuh tempo yang diingatkan. */
  invoiceIds?: string[];
  /** Aksi tagihan: tagihan yang akan dibuat. */
  tagihan?: { tenantId: string; roomId: string; periode: string; jatuhTempo: string; sewa: number }[];
};

/** Satu pesan di percakapan owner dengan Kosta (WhatsApp). */
export type PesanKosta = {
  id: string;
  dari: "owner" | "kosta";
  /** ISO datetime. */
  waktu: string;
  teks: string;
  lampiran?: LampiranKosta;
};

/** Satu kos (workspace) yang bisa dikelola pengguna. */
export type WorkspaceRingkas = {
  id: string;
  namaKos: string;
  jumlahKamar: number;
  peran: "owner" | "admin" | "penyewa";
};
