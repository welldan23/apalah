// PATCH /api/dashboard/tiket/[id] { status: "diproses" | "selesai" } — owner/admin memajukan status
// tiket satu langkah (Baru → Diproses → Selesai). Setelah respons terkirim, penyewa dikabari lewat
// WhatsApp dengan tautan status tiketnya.

import { after } from "next/server";

import { getDb } from "@/db";
import { bacaInputStatusTiket, kirimKabarTiket, ubahStatusTiket } from "@/lib/aksi/tiket";
import { bacaJson, pastikanPengelola, responGalat } from "@/lib/aksi/galat";
import { getWorkspaceSessionApi } from "@/lib/data/session";
import { getPengirimWhatsApp } from "@/lib/whatsapp";

export async function PATCH(request: Request, ctx: RouteContext<"/api/dashboard/tiket/[id]">) {
  try {
    const session = await getWorkspaceSessionApi();
    pastikanPengelola(session.peran);
    const { id } = await ctx.params;
    const status = bacaInputStatusTiket(await bacaJson(request));
    const db = await getDb();
    const tiket = await ubahStatusTiket(db, session.organization.id, id, status);
    const baseUrl = process.env.APP_URL ?? new URL(request.url).origin;
    after(async () => {
      try {
        await kirimKabarTiket(db, id, { wa: getPengirimWhatsApp(), baseUrl });
      } catch (err) {
        console.error(`Gagal mengabari penyewa soal tiket ${id}:`, err);
      }
    });
    return Response.json({ tiket });
  } catch (err) {
    return responGalat(err);
  }
}
