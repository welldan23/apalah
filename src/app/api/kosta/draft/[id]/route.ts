// POST /api/kosta/draft/[id] — owner/admin menyetujui atau membatalkan preview aksi Kosta dari web.
// Body: { keputusan: "setuju" | "batal" }. Keputusan & balasan Kosta dicatat di percakapan.

import { getDb } from "@/db";
import { bacaJson, GalatAksi, pastikanPengelola, responGalat } from "@/lib/aksi/galat";
import { getWorkspaceSessionApi } from "@/lib/data/session";
import { putuskanDraft } from "@/lib/kosta/draft";
import { catatPesan } from "@/lib/kosta/riwayat";
import { getPengirimWhatsApp } from "@/lib/whatsapp";

export async function POST(request: Request, ctx: RouteContext<"/api/kosta/draft/[id]">) {
  try {
    const { id } = await ctx.params;
    const session = await getWorkspaceSessionApi();
    pastikanPengelola(session.peran);
    const { keputusan } = await bacaJson(request);
    if (keputusan !== "setuju" && keputusan !== "batal") {
      throw new GalatAksi('Keputusan harus "setuju" atau "batal".');
    }

    const db = await getDb();
    const organizationId = session.organization.id;
    const hasil = await putuskanDraft(
      db,
      { draftId: id, organizationId, keputusan },
      { wa: getPengirimWhatsApp(), baseUrl: process.env.APP_URL ?? new URL(request.url).origin },
    );

    const pesan = hasil.conversationId
      ? [
          await catatPesan(db, {
            conversationId: hasil.conversationId,
            organizationId,
            arah: "masuk",
            isi: keputusan === "batal" ? "Batal" : hasil.aksi === "reminder" ? "Setuju, kirim" : "Setuju, buat",
          }),
          await catatPesan(db, { conversationId: hasil.conversationId, organizationId, arah: "keluar", isi: hasil.balasan }),
        ]
      : [];
    return Response.json({ status: hasil.status, balasan: hasil.balasan, pesan });
  } catch (err) {
    return responGalat(err);
  }
}
