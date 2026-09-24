// POST /api/dashboard/aksi/status-tagihan — owner mengaktifkan tagihan Draft atau menandai tagihan
// Perlu review sudah diperiksa. Body: { invoiceIds, status: "menunggu" }.
// Status Lunas, Perlu review, dan Jatuh tempo tidak bisa diubah manual (lihat lib/aksi/status-tagihan).

import { getDb } from "@/db";
import { bacaJson, pastikanPengelola, responGalat } from "@/lib/aksi/galat";
import { bacaInputUbahStatus, ubahStatusTagihan } from "@/lib/aksi/status-tagihan";
import { getWorkspaceSession } from "@/lib/data/session";
import { hariIniWib } from "@/lib/waktu";

export async function POST(request: Request) {
  try {
    const session = await getWorkspaceSession();
    pastikanPengelola(session.peran);
    const input = bacaInputUbahStatus(await bacaJson(request));
    return Response.json(await ubahStatusTagihan(await getDb(), session.organization.id, input, hariIniWib()));
  } catch (err) {
    return responGalat(err);
  }
}
