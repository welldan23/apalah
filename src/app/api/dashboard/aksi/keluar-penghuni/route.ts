// POST /api/dashboard/aksi/keluar-penghuni — catat penghuni keluar (setelah owner mengonfirmasi
// preview). Body: { roomId, tanggal, alasan? }. Tagihan belum lunas tetap tercatat.

import { getDb } from "@/db";
import { bacaJson, pastikanPengelola, responGalat } from "@/lib/aksi/galat";
import { bacaInputKeluarPenghuni, keluarPenghuni } from "@/lib/aksi/penghuni";
import { getWorkspaceSession } from "@/lib/data/session";
import { hariIniWib } from "@/lib/waktu";

export async function POST(request: Request) {
  try {
    const session = await getWorkspaceSession();
    pastikanPengelola(session.peran);
    const input = bacaInputKeluarPenghuni(await bacaJson(request));
    return Response.json(await keluarPenghuni(await getDb(), session.organization.id, input, hariIniWib()));
  } catch (err) {
    return responGalat(err);
  }
}
