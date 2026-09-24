// POST /api/dashboard/aksi/kirim-tagihan — kirim link invoice ke WhatsApp penyewa untuk tagihan
// yang dipilih owner (setelah konfirmasi). Body: { invoiceIds }.

import { getDb } from "@/db";
import { bacaJson, pastikanPengelola, responGalat } from "@/lib/aksi/galat";
import { bacaInputKirimTagihan, kirimTagihan } from "@/lib/aksi/status-tagihan";
import { getWorkspaceSessionApi } from "@/lib/data/session";
import { hariIniWib } from "@/lib/waktu";
import { getPengirimWhatsApp } from "@/lib/whatsapp";

export async function POST(request: Request) {
  try {
    const session = await getWorkspaceSessionApi();
    pastikanPengelola(session.peran);
    const input = bacaInputKirimTagihan(await bacaJson(request));
    const baseUrl = process.env.APP_URL ?? new URL(request.url).origin;
    const hasil = await kirimTagihan(await getDb(), session.organization.id, input, getPengirimWhatsApp(), {
      baseUrl,
      hariIni: hariIniWib(),
    });
    return Response.json(hasil);
  } catch (err) {
    return responGalat(err);
  }
}
