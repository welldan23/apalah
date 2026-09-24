// Kontrak data halaman Dashboard Kos.
// Kos, kamar, dan invoice dibaca dari database; pemasukan masih dari data tiruan
// sampai lapisan backend-nya selesai — bentuk `DashboardData` tetap sama.

import { connection } from "next/server";

import { getDb } from "@/db";
import { getDaftarInvoice } from "@/lib/data/invoice";
import { getRingkasanKos } from "@/lib/data/kos";
import { getWorkspaceSession } from "@/lib/data/session";
import { mockPayments } from "@/lib/mock/kos-melati";
import type {
  DashboardData,
  InvoiceRow,
  InvoiceStatus,
  PaymentRow,
  RekapTagihan,
} from "@/lib/types";
import { hariIniWib } from "@/lib/waktu";

export async function getDashboardData(): Promise<DashboardData> {
  // Data dashboard selalu per-request (milik workspace yang sedang masuk), jangan di-prerender.
  await connection();

  const session = await getWorkspaceSession();
  const organizationId = session.organization.id;
  const hariIni = hariIniWib();
  const periode = hariIni.slice(0, 7);

  const db = await getDb();
  const [ringkasan, invoices] = await Promise.all([
    getRingkasanKos(db, organizationId),
    getDaftarInvoice(db, organizationId, { periode }),
  ]);
  if (!ringkasan) throw new Error(`Organisasi ${organizationId} tidak ditemukan`);

  const rekap = (rows: InvoiceRow[]): RekapTagihan => ({
    jumlah: rows.length,
    nominal: rows.reduce((total, inv) => total + inv.nominal, 0),
  });
  const denganStatus = (status: InvoiceStatus) =>
    invoices.filter((inv) => inv.status === status);
  const lunas = rekap(denganStatus("lunas"));

  // Pemasukan dihitung dari pembayaran valid (hasil webhook), bukan dari status invoice.
  const invoiceById = new Map(invoices.map((inv) => [inv.id, inv]));
  const pembayaran: PaymentRow[] = mockPayments
    .filter((p) => p.status === "valid" && invoiceById.has(p.invoiceId))
    .map((p) => {
      const inv = invoiceById.get(p.invoiceId)!;
      return {
        id: p.id,
        invoiceId: p.invoiceId,
        nominalDibayar: p.nominalDibayar,
        metode: p.metode,
        diverifikasiPada: p.diverifikasiPada,
        namaPenghuni: inv.namaPenghuni,
        nomorKamar: inv.nomorKamar,
      };
    })
    .sort((a, b) => b.diverifikasiPada.localeCompare(a.diverifikasiPada));

  return {
    organization: ringkasan.organization,
    owner: session.user,
    hariIni,
    periode,
    kamar: ringkasan.kamar,
    tagihan: {
      total: rekap(invoices),
      lunas,
      menunggu: rekap(denganStatus("menunggu")),
      jatuhTempo: rekap(denganStatus("jatuh_tempo")),
    },
    pemasukan: {
      bulanIni: pembayaran.reduce((total, p) => total + p.nominalDibayar, 0),
      jumlahPembayaran: pembayaran.length,
      terakhir: pembayaran.slice(0, 3),
    },
    invoices,
  };
}
