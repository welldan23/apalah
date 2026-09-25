// Tiket contoh penyewa Kos Melati — diisikan ke tabel tickets oleh data contoh (seed).

import type { TiketPenyewa } from "@/lib/tiket";

type TiketContoh = TiketPenyewa & { nomorKamar: string };

export const mockTiketContoh: TiketContoh[] = [
  {
    id: "tkt_b06_1",
    nomor: "TKT-0014",
    nomorKamar: "B06",
    kategori: "keamanan",
    deskripsi: "Gembok gerbang depan susah dikunci, kadang terbuka sendiri kalau malam.",
    status: "baru",
    dibuatPada: "2026-09-24T12:40:00.000Z",
    diperbaruiPada: "2026-09-24T12:40:00.000Z",
  },
  {
    id: "tkt_c09_1",
    nomor: "TKT-0013",
    nomorKamar: "C09",
    kategori: "tagihan",
    deskripsi: "Saya sudah transfer Rp750.000 tapi status tagihan masih belum lunas. Mohon dicek.",
    status: "baru",
    dibuatPada: "2026-09-23T13:05:00.000Z",
    diperbaruiPada: "2026-09-23T13:05:00.000Z",
  },
  {
    id: "tkt_a05_1",
    nomor: "TKT-0012",
    nomorKamar: "A05",
    kategori: "air_listrik",
    deskripsi: "Keran kamar mandi bocor sejak kemarin malam, lantai jadi basah terus.",
    status: "diproses",
    dibuatPada: "2026-09-22T13:15:00.000Z",
    diperbaruiPada: "2026-09-23T02:00:00.000Z",
  },
  {
    id: "tkt_a10_1",
    nomor: "TKT-0010",
    nomorKamar: "A10",
    kategori: "perbaikan",
    deskripsi: "AC tidak dingin lagi, hanya keluar angin.",
    status: "diproses",
    dibuatPada: "2026-09-18T03:20:00.000Z",
    diperbaruiPada: "2026-09-19T08:10:00.000Z",
  },
  {
    id: "tkt_a05_2",
    nomor: "TKT-0007",
    nomorKamar: "A05",
    kategori: "kebersihan",
    deskripsi: "Saluran air di depan kamar mampet, air menggenang kalau hujan.",
    status: "selesai",
    dibuatPada: "2026-09-08T04:30:00.000Z",
    diperbaruiPada: "2026-09-10T07:45:00.000Z",
  },
];
