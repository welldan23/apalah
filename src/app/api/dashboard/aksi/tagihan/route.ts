// POST /api/dashboard/aksi/tagihan — buat tagihan massal untuk kamar terpilih beserta rinciannya
// (setelah owner mengonfirmasi preview).
// Body: { periode, jatuhTempo, roomIds, nominalKhusus?, biayaTambahan?: [{ label, nominal }] }.

import { getDb } from "@/db";
import { bacaJson, pastikanPengelola, responGalat } from "@/lib/aksi/galat";
import { bacaInputBuatTagihan, buatTagihan } from "@/lib/aksi/tagihan";
import { getWorkspaceSession } from "@/lib/data/session";

export async function POST(request: Request) {
  try {
    const session = await getWorkspaceSession();
    pastikanPengelola(session.peran);
    const input = bacaInputBuatTagihan(await bacaJson(request));
    const hasil = await buatTagihan(await getDb(), session.organization.id, input);
    return Response.json(hasil, { status: 201 });
  } catch (err) {
    return responGalat(err);
  }
}
