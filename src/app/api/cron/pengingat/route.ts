// GET /api/cron/pengingat — kirim pengingat bayar otomatis sesuai jadwal tiap kos (lihat
// src/lib/penjadwal/pengingat-otomatis.ts). Header: Authorization: Bearer <CRON_SECRET>.
// Idealnya dipanggil TIAP JAM (crontab VPS: "5 * * * *") supaya pesan keluar tepat di jam kirim.
// vercel.json memakai sekali sehari pukul 09.05 WIB agar tetap jalan di paket Vercel Hobby;
// jadwal di jam lain menyusul paling lambat 24 jam. Aman dipanggil berulang/bersamaan.

import { getDb } from "@/db";
import { kirimPengingatOtomatis } from "@/lib/penjadwal/pengingat-otomatis";
import { cronDiizinkan } from "@/lib/penjadwal/otorisasi";
import { urlSitus } from "@/lib/situs";
import { getPengirimWhatsApp } from "@/lib/whatsapp";

export async function GET(request: Request) {
  if (!cronDiizinkan(request.headers.get("authorization"))) {
    return Response.json({ error: "Tidak diizinkan." }, { status: 401 });
  }
  const hasil = await kirimPengingatOtomatis(await getDb(), { wa: getPengirimWhatsApp(), baseUrl: urlSitus() });
  return Response.json(hasil);
}
