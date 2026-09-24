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
