// GET /api/cron/harian — pekerjaan harian penjadwal untuk semua kos (tanggal WIB):
// 1. terbitkan tagihan terjadwal yang tanggal terbitnya sudah tiba;
// 2. tandai tagihan yang lewat jatuh tempo;
// 3. batalkan preview aksi Kosta yang menunggu konfirmasi lebih dari 24 jam (tercatat di audit).
// Dipanggil sekali sehari pukul 00.05 WIB oleh Vercel Cron (lihat vercel.json) atau crontab di VPS,
// dengan header Authorization: Bearer <CRON_SECRET>. Aman dipanggil berulang.

import { getDb } from "@/db";
import { kedaluwarsakanDraftDanCatat } from "@/lib/kosta/keputusan";
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
  const previewKedaluwarsa = await kedaluwarsakanDraftDanCatat(db);
  return Response.json({ hariIni, tagihanTerjadwal, jatuhTempo, previewKedaluwarsa });
}
