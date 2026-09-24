// GET /api/dashboard/invoices?status=jatuh_tempo&periode=2026-09
// Daftar invoice milik workspace yang sedang masuk. `status` kosong/"semua" = semua status;
// `periode` kosong = periode berjalan (WIB).

import type { NextRequest } from "next/server";

import { getDb } from "@/db";
import { getDaftarInvoice, isInvoiceStatus } from "@/lib/data/invoice";
import { getWorkspaceSession } from "@/lib/data/session";
import { periodeValid, periodeWib } from "@/lib/waktu";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const status = params.get("status") ?? "semua";
  const periode = params.get("periode") ?? periodeWib();

  if (status !== "semua" && !isInvoiceStatus(status)) {
    return Response.json({ error: `Status tidak dikenal: ${status}` }, { status: 400 });
  }
  if (!periodeValid(periode)) {
    return Response.json({ error: "Periode harus berformat YYYY-MM" }, { status: 400 });
  }

  const session = await getWorkspaceSession();
  const invoices = await getDaftarInvoice(await getDb(), session.organization.id, {
    periode,
    status: status === "semua" ? undefined : status,
  });
  return Response.json({ periode, status, jumlah: invoices.length, invoices });
}
