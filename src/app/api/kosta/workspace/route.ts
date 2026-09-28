// POST /api/kosta/workspace — ganti kos yang dibahas Kosta dari web. Body: { organizationId }.
// Hanya kos tempat pengguna menjadi owner/admin aktif.

import { getDb } from "@/db";
import { bacaJson, GalatAksi, pastikanPengelola, responGalat } from "@/lib/aksi/galat";
import { getWorkspaceSessionApi } from "@/lib/data/session";
import { kosDipilih } from "@/lib/kosta/proses-pesan";
import { catatPesan, pastikanPercakapan } from "@/lib/kosta/riwayat";
import { pilihWorkspace } from "@/lib/kosta/workspace";

export async function POST(request: Request) {
  try {
    const session = await getWorkspaceSessionApi();
    pastikanPengelola(session.peran);
    const { organizationId } = await bacaJson(request);
    if (typeof organizationId !== "string") throw new GalatAksi("Pilih kos terlebih dulu.");

    const db = await getDb();
    const percakapan = await pastikanPercakapan(db, session.user.nomorWa);
    const hasil = await pilihWorkspace(db, percakapan.id, organizationId);
    if (!hasil) throw new GalatAksi("Kamu tidak punya akses ke kos itu.", 403);

    const pesan = await catatPesan(db, {
      conversationId: percakapan.id,
      organizationId: hasil.workspace.id,
      arah: "keluar",
      isi: kosDipilih(hasil.workspace),
    });
    return Response.json({ workspace: hasil.workspace, pesan });
  } catch (err) {
    return responGalat(err);
  }
}
