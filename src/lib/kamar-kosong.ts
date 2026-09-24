// Saring & urutkan kamar kosong (halaman /kamar/kosong).

import { selisihHari } from "./format.ts";

export type UrutKamarKosong = "nomor" | "terlama" | "termurah" | "termahal";

export const PILIHAN_URUT_KOSONG: { value: UrutKamarKosong; label: string }[] = [
  { value: "nomor", label: "Nomor kamar" },
  { value: "terlama", label: "Paling lama kosong" },
  { value: "termurah", label: "Harga termurah" },
  { value: "termahal", label: "Harga termahal" },
];

/** Nilai `?urut=` yang tidak dikenal dianggap "nomor". */
export function parseUrutKosong(value: string | null | undefined): UrutKamarKosong {
  return PILIHAN_URUT_KOSONG.some((u) => u.value === value) ? (value as UrutKamarKosong) : "nomor";
}

type Kamar = { nomorKamar: string; tipe: string; hargaSewa: number; kosongSejak?: string };

const nomor = (a: Kamar, b: Kamar) => a.nomorKamar.localeCompare(b.nomorKamar, "id", { numeric: true });

const PEMBANDING: Record<UrutKamarKosong, (a: Kamar, b: Kamar) => number> = {
  nomor,
  // Kamar tanpa riwayat penghuni (tanggal tidak diketahui) di bawah.
  terlama: (a, b) =>
    (a.kosongSejak ?? "9999").localeCompare(b.kosongSejak ?? "9999") || nomor(a, b),
  termurah: (a, b) => a.hargaSewa - b.hargaSewa || nomor(a, b),
  termahal: (a, b) => b.hargaSewa - a.hargaSewa || nomor(a, b),
};

/** Tipe `null` = semua tipe; `hargaMaks` = sewa paling mahal. Tidak mengubah array asal. */
export function saringKamarKosong<T extends Kamar>(
  kamar: T[],
  { tipe, urut, hargaMaks }: { tipe: string | null; urut: UrutKamarKosong; hargaMaks?: number },
): T[] {
  return kamar
    .filter((k) => (!tipe || k.tipe === tipe) && (!hargaMaks || k.hargaSewa <= hargaMaks))
    .sort(PEMBANDING[urut]);
}

export type FilterKamarKosong = { tipe: string | null; urut: UrutKamarKosong; hargaMaks?: number };

/** Query `?tipe=&urut=&hargaMaks=` endpoint kamar kosong; nilai tidak dikenal ditolak dengan galat. */
export function bacaFilterKamarKosong(params: URLSearchParams): { filter: FilterKamarKosong } | { galat: string } {
  const tipe = params.get("tipe")?.trim() || null;
  const urut = params.get("urut") || "nomor";
  const harga = params.get("hargaMaks");
  if (!PILIHAN_URUT_KOSONG.some((u) => u.value === urut)) return { galat: `Urutan tidak dikenal: ${urut}` };
  if (harga !== null && !/^[1-9]\d{0,9}$/.test(harga)) return { galat: "hargaMaks harus bilangan bulat rupiah lebih dari 0." };
  return {
    filter: { tipe, urut: urut as UrutKamarKosong, ...(harga !== null ? { hargaMaks: Number(harga) } : {}) },
  };
}

/** Jumlah hari kamar kosong sejak penghuni terakhir keluar, atau undefined bila tidak diketahui. */
export function hariKosong(kosongSejak: string | undefined, hariIni: string) {
  return kosongSejak ? Math.max(0, selisihHari(kosongSejak, hariIni)) : undefined;
}
