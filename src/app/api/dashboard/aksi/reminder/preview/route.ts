// POST /api/dashboard/aksi/reminder/preview — preview reminder massal sebelum dikirim: penerima,
// isi pesan persis, total, dan penyewa yang dilewati (sudah dihubungi < 24 jam). Tidak mengirim apa pun.
// Body: { invoiceIds }. Kirimnya lewat POST /api/dashboard/aksi/reminder dengan invoiceIds penerima.

import { getDb } from "@/db";
import { bacaJson, pastikanPengelola, responGalat } from "@/lib/aksi/galat";
import { previewReminder } from "@/lib/aksi/preview-reminder";
import { bacaInputKirimReminder } from "@/lib/aksi/reminder";
import { getWorkspaceSession } from "@/lib/data/session";
import { hariIniWib } from "@/lib/waktu";

export async function POST(request: Request) {
  try {
    const session = await getWorkspaceSession();
    pastikanPengelola(session.peran);
    const { invoiceIds } = bacaInputKirimReminder(await bacaJson(request));
    const baseUrl = process.env.APP_URL ?? new URL(request.url).origin;
    return Response.json(
      await previewReminder(await getDb(), session.organization.id, invoiceIds, { baseUrl, hariIni: hariIniWib() }),
    );
  } catch (err) {
    return responGalat(err);
  }
}
