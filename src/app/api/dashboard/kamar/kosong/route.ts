// GET /api/dashboard/kamar/kosong?tipe=AC&urut=terlama&hargaMaks=700000
// Kamar kosong (aktif) milik kos yang sedang masuk, dengan lama kosong & penghuni terakhir.
// - tipe: nama tipe kamar (kosong = semua); urut: nomor (bawaan) | terlama | termurah | termahal;
// - hargaMaks: sewa paling mahal (rupiah).

import type { NextRequest } from "next/server";

import { getDb } from "@/db";
import { getKamarKosong } from "@/lib/data/kamar";
import { getWorkspaceSession } from "@/lib/data/session";
import { bacaFilterKamarKosong, hariKosong, saringKamarKosong } from "@/lib/kamar-kosong";
import { hariIniWib } from "@/lib/waktu";

export async function GET(request: NextRequest) {
  const hasil = bacaFilterKamarKosong(request.nextUrl.searchParams);
  if ("galat" in hasil) return Response.json({ error: hasil.galat }, { status: 400 });

  const session = await getWorkspaceSession();
  const semua = await getKamarKosong(await getDb(), session.organization.id);
  const hariIni = hariIniWib();
  const kamar = saringKamarKosong(semua, hasil.filter).map((k) => ({ ...k, hariKosong: hariKosong(k.kosongSejak, hariIni) }));
  return Response.json({
    ...hasil.filter,
    daftarTipe: [...new Set(semua.map((k) => k.tipe))],
    jumlah: kamar.length,
    potensiSewa: kamar.reduce((total, k) => total + k.hargaSewa, 0),
    kamar,
  });
}
