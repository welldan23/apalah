// POST /api/dashboard/aksi/reminder — kirim pengingat WhatsApp untuk tagihan belum dibayar
// yang dipilih owner (setelah preview). Body: { invoiceIds }.

import { getDb } from "@/db";
import { bacaJson, pastikanPengelola, responGalat } from "@/lib/aksi/galat";
import { bacaInputKirimReminder, kirimReminder } from "@/lib/aksi/reminder";
import { getWorkspaceSession } from "@/lib/data/session";
import { getPengirimWhatsApp } from "@/lib/whatsapp";

export async function POST(request: Request) {
  try {
    const session = await getWorkspaceSession();
    pastikanPengelola(session.peran);
    const input = bacaInputKirimReminder(await bacaJson(request));
    const baseUrl = process.env.APP_URL ?? new URL(request.url).origin;
    const hasil = await kirimReminder(
      await getDb(),
      session.organization.id,
      input,
      getPengirimWhatsApp(),
      { baseUrl },
    );
    return Response.json(hasil);
  } catch (err) {
    return responGalat(err);
  }
}
