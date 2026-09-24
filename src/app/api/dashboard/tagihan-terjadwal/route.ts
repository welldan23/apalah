// GET /api/dashboard/tagihan-terjadwal — pengaturan tagihan terjadwal kos yang sedang masuk.
// PUT /api/dashboard/tagihan-terjadwal — simpan pengaturan (owner/admin).
// Body: { aktif, tanggalTerbit: 1–28, jatuhTempo: { aturan: "tanggal_masuk" } | { aturan: "tanggal_tetap", tanggal: 1–28 } }.

import { getDb } from "@/db";
import { bacaJson, pastikanPengelola, responGalat } from "@/lib/aksi/galat";
import {
  bacaInputPengaturan,
  getPengaturanTagihanTerjadwal,
  simpanPengaturanTagihanTerjadwal,
} from "@/lib/aksi/tagihan-terjadwal";
import { getWorkspaceSession } from "@/lib/data/session";

export async function GET() {
  const session = await getWorkspaceSession();
  return Response.json(await getPengaturanTagihanTerjadwal(await getDb(), session.organization.id));
}

export async function PUT(request: Request) {
  try {
    const session = await getWorkspaceSession();
    pastikanPengelola(session.peran);
    const input = bacaInputPengaturan(await bacaJson(request));
    return Response.json(
      await simpanPengaturanTagihanTerjadwal(await getDb(), session.organization.id, input),
    );
  } catch (err) {
    return responGalat(err);
  }
}
