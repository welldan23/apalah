// POST /api/akun/workspace-aktif { organizationId } — ganti kos yang sedang dibuka di sesi login.
// Hanya kos tempat pengguna punya keanggotaan aktif (selain itu 403).

import { getDb } from "@/db";
import { bacaJson, GalatAksi, responGalat } from "@/lib/aksi/galat";
import { getSesiLogin } from "@/lib/auth/server";
import { pilihWorkspaceAktif } from "@/lib/auth/workspace";

export async function POST(request: Request) {
  try {
    const sesi = await getSesiLogin(request.headers);
    if (!sesi) throw new GalatAksi("Sesi berakhir. Masuk lagi dengan nomor WhatsApp.", 401);
    const { organizationId } = await bacaJson(request);
    if (typeof organizationId !== "string" || !organizationId) throw new GalatAksi("Pilih kos yang mau dibuka.");
    const kos = await pilihWorkspaceAktif(await getDb(), { userId: sesi.user.id, sessionId: sesi.session.id }, organizationId);
    return Response.json(kos);
  } catch (err) {
    return responGalat(err);
  }
}
