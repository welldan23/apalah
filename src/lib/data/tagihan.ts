// Kontrak data halaman Tagihan & Invoice: daftar invoice satu periode milik workspace
// yang sedang masuk. Periode kosong/tidak valid = periode berjalan (WIB).

import { connection } from "next/server";

import { getDb } from "@/db";
import { getDaftarInvoice } from "@/lib/data/invoice";
import { getWorkspaceSession } from "@/lib/data/session";
import type { InvoiceRow } from "@/lib/types";
import { hariIniWib, periodeValid } from "@/lib/waktu";

export type HalamanTagihan = {
  hariIni: string;
  /** Periode yang sedang ditampilkan, YYYY-MM. */
  periode: string;
  /** Periode berjalan menurut WIB, YYYY-MM. */
  periodeBerjalan: string;
  invoices: InvoiceRow[];
};

export async function getHalamanTagihan(periodeDiminta?: string): Promise<HalamanTagihan> {
  await connection();

  const session = await getWorkspaceSession();
  const hariIni = hariIniWib();
  const periodeBerjalan = hariIni.slice(0, 7);
  const periode =
    periodeDiminta && periodeValid(periodeDiminta) ? periodeDiminta : periodeBerjalan;

  const invoices = await getDaftarInvoice(await getDb(), session.organization.id, { periode });
  return { hariIni, periode, periodeBerjalan, invoices };
}
