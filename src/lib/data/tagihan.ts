// Kontrak data halaman Tagihan & Invoice: daftar invoice satu periode milik workspace
// yang sedang masuk. Periode kosong/tidak valid = periode berjalan (WIB).

import { connection } from "next/server";

import { getDb } from "@/db";
import { getDaftarInvoice } from "@/lib/data/invoice";
import { getRingkasanKos } from "@/lib/data/kos";
import { getWorkspaceSession } from "@/lib/data/session";
import type { InvoiceRow, RoomCell } from "@/lib/types";
import { hariIniWib, periodeValid } from "@/lib/waktu";

export type HalamanTagihan = {
  hariIni: string;
  /** Periode yang sedang ditampilkan, YYYY-MM. */
  periode: string;
  /** Periode berjalan menurut WIB, YYYY-MM. */
  periodeBerjalan: string;
  invoices: InvoiceRow[];
  /** Kamar terisi — pilihan kamar di form Buat tagihan. */
  kamarTerisi: RoomCell[];
};

export async function getHalamanTagihan(periodeDiminta?: string): Promise<HalamanTagihan> {
  await connection();

  const session = await getWorkspaceSession();
  const hariIni = hariIniWib();
  const periodeBerjalan = hariIni.slice(0, 7);
  const periode =
    periodeDiminta && periodeValid(periodeDiminta) ? periodeDiminta : periodeBerjalan;

  const db = await getDb();
  const [invoices, ringkasan] = await Promise.all([
    getDaftarInvoice(db, session.organization.id, { periode }),
    getRingkasanKos(db, session.organization.id),
  ]);
  const kamarTerisi = ringkasan?.kamar.daftar.filter((k) => k.status === "terisi") ?? [];
  return { hariIni, periode, periodeBerjalan, invoices, kamarTerisi };
}
