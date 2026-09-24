// POST /api/dashboard/aksi/penghuni — catat penghuni baru di kamar kosong (setelah owner
// mengonfirmasi preview). Body: { nama, nomorWa, roomId, tanggalMasuk, hargaSewa }.

import { getDb } from "@/db";
import { bacaJson, pastikanPengelola, responGalat } from "@/lib/aksi/galat";
import { bacaInputTambahPenghuni, tambahPenghuni } from "@/lib/aksi/penghuni";
import { getWorkspaceSession } from "@/lib/data/session";

export async function POST(request: Request) {
  try {
    const session = await getWorkspaceSession();
    pastikanPengelola(session.peran);
    const input = bacaInputTambahPenghuni(await bacaJson(request));
    const hasil = await tambahPenghuni(await getDb(), session.organization.id, input);
    return Response.json(hasil, { status: 201 });
  } catch (err) {
    return responGalat(err);
  }
}
