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

export type DashboardData = {
  organization: Organization;
  owner: Owner;
  /** Hari ini menurut server, format YYYY-MM-DD. */
  hariIni: string;
  /** Periode berjalan, format YYYY-MM. */
  periode: string;
  kamar: RingkasanKamar;
  /** Rekap invoice periode berjalan per status. */
  tagihan: {
    total: RekapTagihan;
    lunas: RekapTagihan;
    menunggu: RekapTagihan;
    jatuhTempo: RekapTagihan;
  };
  pemasukan: {
    /** Total pembayaran valid yang masuk di periode berjalan. */
    bulanIni: number;
    /** Jumlah pembayaran valid di periode berjalan. */
    jumlahPembayaran: number;
    /** Pembayaran valid terbaru, paling baru di atas. */
    terakhir: PaymentRow[];
  };
  /** Invoice periode berjalan, urut dari yang paling perlu ditindak. */
  invoices: InvoiceRow[];
};
