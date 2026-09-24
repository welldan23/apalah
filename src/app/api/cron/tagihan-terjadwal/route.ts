// GET /api/cron/tagihan-terjadwal — menerbitkan tagihan terjadwal hari ini (WIB) untuk semua kos.
// Dipanggil sekali sehari pukul 00.05 WIB oleh Vercel Cron (lihat vercel.json) atau crontab di VPS, dengan header
// Authorization: Bearer <CRON_SECRET>. Aman dipanggil berulang.

import { getDb } from "@/db";
import { cronDiizinkan } from "@/lib/penjadwal/otorisasi";
import { terbitkanTagihanTerjadwal } from "@/lib/penjadwal/tagihan-terjadwal";
import { hariIniWib } from "@/lib/waktu";

export async function GET(request: Request) {
  if (!cronDiizinkan(request.headers.get("authorization"))) {
    return Response.json({ error: "Tidak diizinkan." }, { status: 401 });
  }
  const hariIni = hariIniWib();
  const hasil = await terbitkanTagihanTerjadwal(await getDb(), hariIni);
  return Response.json({ hariIni, hasil });
}
