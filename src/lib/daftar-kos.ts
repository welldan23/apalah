// Data kos pertama saat daftar — dipakai form pembuatan workspace dan (nanti) endpoint-nya.

/** Sama dengan batas sekali tambah kamar. */
export const MAKS_KAMAR_AWAL = 500;

export type DataKosPertama = { namaPemilik: string; namaKos: string; jumlahKamar: number };
export type GalatDataKos = Partial<Record<keyof DataKosPertama, string>>;

/** Galat per kolom; objek kosong = valid. */
export function periksaDataKos({ namaPemilik, namaKos, jumlahKamar }: DataKosPertama): GalatDataKos {
  const galat: GalatDataKos = {};
  const nama = namaPemilik.trim();
  if (!nama) galat.namaPemilik = "Isi nama kamu.";
  else if (nama.length > 60) galat.namaPemilik = "Nama maksimal 60 karakter.";
  const kos = namaKos.trim();
  if (kos.length < 2 || kos.length > 80) galat.namaKos = "Nama kos 2–80 karakter.";
  if (!Number.isInteger(jumlahKamar) || jumlahKamar < 1 || jumlahKamar > MAKS_KAMAR_AWAL) {
    galat.jumlahKamar = `Jumlah kamar 1–${MAKS_KAMAR_AWAL}.`;
  }
  return galat;
}
