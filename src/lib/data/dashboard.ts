// Kontrak data halaman Dashboard Kos — seluruhnya dibaca dari database untuk
// workspace yang sedang masuk, periode berjalan menurut WIB.

import { connection } from "next/server";

import { getDb } from "@/db";
import { getDaftarInvoice } from "@/lib/data/invoice";
import { getRingkasanKos } from "@/lib/data/kos";
import { getRingkasanTiket } from "@/lib/data/halaman-tiket";
import { getRekapPemasukan } from "@/lib/data/pemasukan";
import { getPerluReview } from "@/lib/data/perlu-review";
import { getWorkspaceSession } from "@/lib/data/session";
import type { DashboardData } from "@/lib/types";
import { hariIniWib } from "@/lib/waktu";

export async function getDashboardData(): Promise<DashboardData> {
  // Data dashboard selalu per-request (milik workspace yang sedang masuk), jangan di-prerender.
  await connection();

  const session = await getWorkspaceSession();
  const organizationId = session.organization.id;
  const hariIni = hariIniWib();
  const periode = hariIni.slice(0, 7);

  const db = await getDb();
  const [ringkasan, invoices, rekap, perluReview] = await Promise.all([
    getRingkasanKos(db, organizationId),
    getDaftarInvoice(db, organizationId, { periode }),
    getRekapPemasukan(db, organizationId, { periode }),
    getPerluReview(db, organizationId),
  ]);
  if (!ringkasan) throw new Error(`Organisasi ${organizationId} tidak ditemukan`);

  return {
    organization: ringkasan.organization,
    owner: session.user,
    hariIni,
    periode,
    kamar: ringkasan.kamar,
    tagihan: rekap.tagihan,
    pemasukan: rekap.pemasukan,
    invoices,
    perluReview,
    tiket: getRingkasanTiket(organizationId),
  };
}
