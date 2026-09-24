// PATCH /api/dashboard/kamar/[id] — ubah tipe, harga sewa, catatan, atau nonaktifkan/aktifkan kamar.
// Body: { tipe?, hargaSewa?, catatan?, aktif? }. Kamar terisi tidak bisa dinonaktifkan.

import { getDb } from "@/db";
import { bacaPerubahanKamar, ubahKamar } from "@/lib/aksi/kamar";
import { bacaJson, pastikanPengelola, responGalat } from "@/lib/aksi/galat";
import { getWorkspaceSession } from "@/lib/data/session";

export async function PATCH(request: Request, ctx: RouteContext<"/api/dashboard/kamar/[id]">) {
  try {
    const { id } = await ctx.params;
    const session = await getWorkspaceSession();
    pastikanPengelola(session.peran);
    const perubahan = bacaPerubahanKamar(await bacaJson(request));
    return Response.json(await ubahKamar(await getDb(), session.organization.id, id, perubahan));
  } catch (err) {
    return responGalat(err);
  }
}
