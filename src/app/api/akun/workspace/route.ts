// Workspace (kos) milik pengguna yang sedang masuk (butuh cookie sesi):
// GET  /api/akun/workspace — daftar kos yang bisa dibuka + peran + kos aktif di sesi ini.
//      Ganti kos aktif: POST /api/akun/workspace-aktif { organizationId }.
// POST /api/akun/workspace — langkah terakhir daftar: buat kos pertama.
//      Body: { namaPemilik, namaKos, jumlahKamar: 1–500 }. Organisasi, keanggotaan owner, jadwal
//      pengingat bawaan, dan kos aktif di sesi dibuat sekaligus.

import { getDb } from "@/db";
import { bacaJson, GalatAksi, responGalat } from "@/lib/aksi/galat";
import { bacaInputWorkspace, buatWorkspacePertama } from "@/lib/aksi/workspace";
import { getSesiLogin } from "@/lib/auth/server";
import { daftarKeanggotaanAktif } from "@/lib/auth/workspace";

export async function GET(request: Request) {
  try {
    const sesi = await getSesiLogin(request.headers);
    if (!sesi) throw new GalatAksi("Sesi berakhir. Masuk lagi dengan nomor WhatsApp.", 401);
    const workspaces = await daftarKeanggotaanAktif(await getDb(), sesi.user.id);
    const aktifId = workspaces.some((w) => w.id === sesi.session.organizationId) ? sesi.session.organizationId : null;
    return Response.json({ aktifId, workspaces });
  } catch (err) {
    return responGalat(err);
  }
}

export async function POST(request: Request) {
  try {
    const sesi = await getSesiLogin(request.headers);
    if (!sesi) throw new GalatAksi("Sesi berakhir. Masuk lagi dengan nomor WhatsApp.", 401);
    const input = bacaInputWorkspace(await bacaJson(request));
    const hasil = await buatWorkspacePertama(await getDb(), { userId: sesi.user.id, sessionId: sesi.session.id }, input);
    return Response.json(hasil, { status: 201 });
  } catch (err) {
    return responGalat(err);
  }
}
