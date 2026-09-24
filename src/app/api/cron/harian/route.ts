// GET /api/cron/harian — pekerjaan harian penjadwal untuk semua kos (tanggal WIB):
// 1. terbitkan tagihan terjadwal yang tanggal terbitnya sudah tiba;
// 2. tandai tagihan yang lewat jatuh tempo.
// Dipanggil sekali sehari pukul 00.05 WIB oleh Vercel Cron (lihat vercel.json) atau crontab di VPS,
// dengan header Authorization: Bearer <CRON_SECRET>. Aman dipanggil berulang.

import { getDb } from "@/db";
import { tandaiJatuhTempo } from "@/lib/penjadwal/jatuh-tempo";
import { cronDiizinkan } from "@/lib/penjadwal/otorisasi";
import { terbitkanTagihanTerjadwal } from "@/lib/penjadwal/tagihan-terjadwal";
import { hariIniWib } from "@/lib/waktu";

export async function GET(request: Request) {
  if (!cronDiizinkan(request.headers.get("authorization"))) {
    return Response.json({ error: "Tidak diizinkan." }, { status: 401 });
  }
  const hariIni = hariIniWib();
  const db = await getDb();
  // Terbitkan dulu, supaya tagihan baru yang jatuh temponya sudah lewat langsung ikut ditandai.
  const tagihanTerjadwal = await terbitkanTagihanTerjadwal(db, hariIni);
  const jatuhTempo = await tandaiJatuhTempo(db, hariIni);
  return Response.json({ hariIni, tagihanTerjadwal, jatuhTempo });
}
