// POST /api/dashboard/aksi/pindah-kamar — pindahkan penghuni ke kamar kosong (setelah owner
// mengonfirmasi preview). Body: { dariRoomId, keRoomId, tanggal, sewa: "tetap" | "ikut_kamar" }.

import { getDb } from "@/db";
import { bacaJson, pastikanPengelola, responGalat } from "@/lib/aksi/galat";
import { bacaInputPindahKamar, pindahKamar } from "@/lib/aksi/penghuni";
import { getWorkspaceSession } from "@/lib/data/session";

export async function POST(request: Request) {
  try {
    const session = await getWorkspaceSession();
    pastikanPengelola(session.peran);
    const input = bacaInputPindahKamar(await bacaJson(request));
    return Response.json(await pindahKamar(await getDb(), session.organization.id, input));
  } catch (err) {
    return responGalat(err);
  }
}
