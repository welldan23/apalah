// GET /api/dashboard/ringkasan — ringkasan kos & kamar milik workspace yang sedang masuk.

import { getDb } from "@/db";
import { getRingkasanKos } from "@/lib/data/kos";
import { getWorkspaceSession } from "@/lib/data/session";

export async function GET() {
  const session = await getWorkspaceSession();
  const ringkasan = await getRingkasanKos(await getDb(), session.organization.id);
  if (!ringkasan) {
    return Response.json({ error: "Organisasi tidak ditemukan" }, { status: 404 });
  }
  return Response.json(ringkasan);
}
