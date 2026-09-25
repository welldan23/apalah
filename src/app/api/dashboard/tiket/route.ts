// GET /api/dashboard/tiket — semua tiket keluhan kos yang sedang masuk (owner/admin), lengkap dengan
// kamar & penghuni pelapor; yang masih berjalan di atas.

import { getDb } from "@/db";
import { pastikanPengelola, responGalat } from "@/lib/aksi/galat";
import { getWorkspaceSessionApi } from "@/lib/data/session";
import { getTiketKos } from "@/lib/data/tiket";

export async function GET() {
  try {
    const session = await getWorkspaceSessionApi();
    pastikanPengelola(session.peran);
    return Response.json({ tiket: await getTiketKos(await getDb(), session.organization.id) });
  } catch (err) {
    return responGalat(err);
  }
}
