// GET /api/dashboard/invoices?periode=2026-09&status=jatuh_tempo&q=rizky&urut=nominal
// Daftar invoice milik workspace yang sedang masuk.
// - `periode`: YYYY-MM; kosong = periode berjalan (WIB); "semua" = semua periode.
// - `status`: kosong/"semua" = semua status.
// - `q`: cari nama penghuni atau nomor kamar (tidak peka huruf besar/kecil).
// - `urut`: prioritas (bawaan) | jatuh_tempo | nominal | nama | kamar.

import type { NextRequest } from "next/server";

import { getDb } from "@/db";
import { bacaFilterDaftarInvoice, getDaftarInvoice } from "@/lib/data/invoice";
import { getWorkspaceSession } from "@/lib/data/session";
import { urutkanInvoice } from "@/lib/invoice";
import { periodeWib } from "@/lib/waktu";

export async function GET(request: NextRequest) {
  const hasil = bacaFilterDaftarInvoice(request.nextUrl.searchParams, periodeWib());
  if ("galat" in hasil) return Response.json({ error: hasil.galat }, { status: 400 });
  const { filter } = hasil;

  const session = await getWorkspaceSession();
  const invoices = await getDaftarInvoice(await getDb(), session.organization.id, {
    periode: filter.periode === "semua" ? undefined : filter.periode,
    status: filter.status === "semua" ? undefined : filter.status,
    cari: filter.q,
  });
  return Response.json({ ...filter, jumlah: invoices.length, invoices: urutkanInvoice(invoices, filter.urut) });
}
