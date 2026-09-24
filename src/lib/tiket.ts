// Tiket keluhan / permintaan perbaikan dari penyewa — aturan murni (form & endpoint).

export const KATEGORI_TIKET = [
  { id: "perbaikan", label: "Kerusakan & perbaikan", contoh: "Pintu, kunci, lemari, kasur, AC" },
  { id: "air_listrik", label: "Air & listrik", contoh: "Air mati, keran bocor, lampu atau stopkontak" },
  { id: "kebersihan", label: "Kebersihan", contoh: "Sampah, saluran mampet, area bersama" },
  { id: "keamanan", label: "Keamanan & kenyamanan", contoh: "Gerbang, tamu, kebisingan" },
  { id: "tagihan", label: "Tagihan & pembayaran", contoh: "Nominal, pembayaran belum tercatat" },
  { id: "lainnya", label: "Lainnya", contoh: "Hal lain untuk pemilik kos" },
] as const;

export type KategoriTiket = (typeof KATEGORI_TIKET)[number]["id"];
export type StatusTiket = "baru" | "diproses" | "selesai";

export const LABEL_STATUS_TIKET: Record<StatusTiket, string> = { baru: "Baru", diproses: "Diproses", selesai: "Selesai" };

export const PANJANG_DESKRIPSI = { min: 10, maks: 1000 } as const;

export const labelKategori = (id: string) => KATEGORI_TIKET.find((k) => k.id === id)?.label ?? "Lainnya";

export type GalatTiket = Partial<Record<"kategori" | "deskripsi", string>>;

/** Galat per kolom; objek kosong = valid. */
export function periksaTiket({ kategori, deskripsi }: { kategori: string; deskripsi: string }): GalatTiket {
  const galat: GalatTiket = {};
  if (!KATEGORI_TIKET.some((k) => k.id === kategori)) galat.kategori = "Pilih jenis masalahnya.";
  const panjang = deskripsi.trim().length;
  if (panjang < PANJANG_DESKRIPSI.min) galat.deskripsi = `Ceritakan masalahnya minimal ${PANJANG_DESKRIPSI.min} karakter.`;
  else if (panjang > PANJANG_DESKRIPSI.maks) galat.deskripsi = `Maksimal ${PANJANG_DESKRIPSI.maks} karakter.`;
  return galat;
}

export const URUTAN_STATUS_TIKET: StatusTiket[] = ["baru", "diproses", "selesai"];

export type TiketPenyewa = {
  id: string;
  /** Nomor tiket untuk disebut ke pemilik kos, mis. "TKT-0012". */
  nomor: string;
  kategori: KategoriTiket;
  deskripsi: string;
  status: StatusTiket;
  /** ISO datetime. */
  dibuatPada: string;
  diperbaruiPada: string;
};

/** Tiket yang masih berjalan (baru/diproses) di atas, lalu yang selesai; masing-masing terbaru dulu. */
export function urutkanTiket<T extends Pick<TiketPenyewa, "status" | "dibuatPada">>(tiket: T[]): T[] {
  const selesai = (t: T) => (t.status === "selesai" ? 1 : 0);
  return [...tiket].sort((a, b) => selesai(a) - selesai(b) || b.dibuatPada.localeCompare(a.dibuatPada));
}

/** Tiket di daftar owner: lengkap dengan kamar & penghuni pelapor. */
export type TiketKos = TiketPenyewa & { nomorKamar: string; namaPenghuni: string; nomorWa: string };

/** Jumlah tiket per status. */
export function hitungTiket(tiket: Pick<TiketPenyewa, "status">[]): Record<StatusTiket, number> {
  const jumlah: Record<StatusTiket, number> = { baru: 0, diproses: 0, selesai: 0 };
  for (const t of tiket) jumlah[t.status] += 1;
  return jumlah;
}

/** Status berikutnya yang bisa dipilih owner (baru → diproses → selesai); null bila sudah selesai. */
export const statusBerikutnya = (s: StatusTiket): StatusTiket | null =>
  s === "baru" ? "diproses" : s === "diproses" ? "selesai" : null;
