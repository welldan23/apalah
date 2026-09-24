// GET /api/dashboard/reminder/riwayat?periode=2026-09&status=gagal&jenis=H-3&tagihan=2026-08&q=rizky&batas=50
// Riwayat pengingat bayar kos yang sedang masuk (tanpa pesan kirim tagihan & konfirmasi lunas),
// terbaru di atas, lengkap dengan alasan gagal.
// - `periode`: bulan kirim WIB YYYY-MM; kosong = bulan berjalan; "semua" = semua bulan.
// - `status`: semua | terkirim | gagal.  `jenis`: manual | H-3 | H | H+3 | …; kosong = semua.
// - `tagihan`: periode tagihan YYYY-MM.  `q`: cari nama penghuni atau nomor kamar.
// - `batas`: 1–200 (bawaan 50).  `sebelum`: nilai `berikutnya` dari respons sebelumnya (halaman lanjut).

import type { NextRequest } from "next/server";

import { getDb } from "@/db";
import { pastikanPengelola, responGalat } from "@/lib/aksi/galat";
import { bacaFilterRiwayatReminder, getRiwayatReminder, kursorSetelah } from "@/lib/data/reminder";
import { getWorkspaceSession } from "@/lib/data/session";
import { periodeWib } from "@/lib/waktu";

export async function GET(request: NextRequest) {
  try {
    const session = await getWorkspaceSession();
    pastikanPengelola(session.peran);
    const hasil = bacaFilterRiwayatReminder(request.nextUrl.searchParams, periodeWib());
    if ("galat" in hasil) return Response.json({ galat: hasil.galat }, { status: 400 });

    // Ambil satu baris lebih untuk tahu apakah masih ada halaman berikutnya.
    const baris = await getRiwayatReminder(await getDb(), session.organization.id, {
      ...hasil.filter,
      batas: hasil.query.batas + 1,
    });
    const riwayat = baris.slice(0, hasil.query.batas);
    const berikutnya = baris.length > hasil.query.batas ? kursorSetelah(riwayat.at(-1)!) : null;
    return Response.json({ ...hasil.query, jumlah: riwayat.length, riwayat, berikutnya });
  } catch (err) {
    return responGalat(err);
  }
}
