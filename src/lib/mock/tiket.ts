// Tiket contoh penyewa (tahap frontend) — di tahap backend diganti tabel tickets.

import type { TiketPenyewa } from "@/lib/tiket";

/** Per nomor kamar contoh (Kos Melati). */
export const mockTiketPerKamar: Record<string, TiketPenyewa[]> = {
  A05: [
    {
      id: "tkt_a05_1",
      nomor: "TKT-0012",
      kategori: "air_listrik",
      deskripsi: "Keran kamar mandi bocor sejak kemarin malam, lantai jadi basah terus.",
      status: "diproses",
      dibuatPada: "2026-09-22T13:15:00.000Z",
      diperbaruiPada: "2026-09-23T02:00:00.000Z",
    },
    {
      id: "tkt_a05_2",
      nomor: "TKT-0007",
      kategori: "kebersihan",
      deskripsi: "Saluran air di depan kamar mampet, air menggenang kalau hujan.",
      status: "selesai",
      dibuatPada: "2026-09-08T04:30:00.000Z",
      diperbaruiPada: "2026-09-10T07:45:00.000Z",
    },
  ],
};
