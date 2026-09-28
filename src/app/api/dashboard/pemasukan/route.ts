// GET /api/dashboard/pemasukan?periode=2026-09
// Rekap tagihan per status + uang masuk dari pembayaran valid milik workspace yang sedang
// masuk. `periode` kosong = periode berjalan (WIB).

import type { NextRequest } from "next/server";

import { getDb } from "@/db";
import { responGalat } from "@/lib/aksi/galat";
import { getRekapPemasukan } from "@/lib/data/pemasukan";
import { getWorkspaceSessionApi } from "@/lib/data/session";
import { periodeValid, periodeWib } from "@/lib/waktu";

export async function GET(request: NextRequest) {
  const periode = request.nextUrl.searchParams.get("periode") ?? periodeWib();
  if (!periodeValid(periode)) {
    return Response.json({ error: "Periode harus berformat YYYY-MM" }, { status: 400 });
  }

  const session = await getWorkspaceSessionApi().catch(responGalat);
  if (session instanceof Response) return session;
  const rekap = await getRekapPemasukan(await getDb(), session.organization.id, { periode });
  return Response.json({ periode, ...rekap });
}
