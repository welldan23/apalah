// GET /api/dashboard/jadwal-pengingat — saklar pengingat otomatis + jadwal kos yang sedang masuk.
// PUT /api/dashboard/jadwal-pengingat — simpan satu set lengkap (owner/admin); jadwal yang tidak
// disebut dihapus. Body: { otomatisAktif: boolean, jadwal: [{ offsetHari: -14…14, jam: "HH:MM", aktif }] },
// maksimal 5 jadwal, satu per offset, jam 06:00–21:00.

import { getDb } from "@/db";
import { bacaJson, pastikanPengelola, responGalat } from "@/lib/aksi/galat";
import {
  bacaInputPengaturanPengingat,
  getPengaturanPengingat,
  simpanPengaturanPengingat,
} from "@/lib/aksi/jadwal-pengingat";
import { getWorkspaceSessionApi } from "@/lib/data/session";

export async function GET() {
  try {
    const session = await getWorkspaceSessionApi();
    pastikanPengelola(session.peran);
    return Response.json(await getPengaturanPengingat(await getDb(), session.organization.id));
  } catch (err) {
    return responGalat(err);
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getWorkspaceSessionApi();
    pastikanPengelola(session.peran);
    const input = bacaInputPengaturanPengingat(await bacaJson(request));
    return Response.json(await simpanPengaturanPengingat(await getDb(), session.organization.id, input));
  } catch (err) {
    return responGalat(err);
  }
}
