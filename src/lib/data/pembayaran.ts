// Tagihan + pembayaran yang sudah diterima — untuk halaman Pemantauan Pembayaran.
// "Dibayar" = uang yang diterima gateway (valid maupun tidak cocok); pembayaran pending
// belum dihitung. Status Lunas tetap hanya dari pembayaran valid.

import { desc, inArray, sql } from "drizzle-orm";

import { schema, type Db } from "../../db/index.ts";
import { getDaftarInvoice } from "./invoice.ts";
import type { InvoiceRow, InvoiceStatus, PaymentStatus } from "@/lib/types";

const { payments } = schema;

export type PembayaranTercatat = {
  id: string;
  nominal: number;
  metode: string;
  provider: string;
  referensi: string;
  status: PaymentStatus;
  /** ISO datetime verifikasi gateway; kosong bila masih pending. */
  waktu?: string;
};

export type TagihanPembayaran = InvoiceRow & {
  dibayar: number;
  /** Pembayaran terakhir yang sudah diterima (bukan pending). */
  pembayaranTerakhir?: PembayaranTercatat;
  /** Semua pembayaran untuk tagihan ini, termasuk pending; terbaru di atas. */
  riwayat: PembayaranTercatat[];
};

/** Filter sama dengan getDaftarInvoice: periode kosong = semua periode. */
export async function getDaftarTagihanPembayaran(
  db: Db,
  organizationId: string,
  filter: { periode?: string; status?: InvoiceStatus },
): Promise<TagihanPembayaran[]> {
  const invoices = await getDaftarInvoice(db, organizationId, filter);
  if (invoices.length === 0) return [];

  const bayar = await db
    .select({
      id: payments.id,
      invoiceId: payments.invoiceId,
      nominal: payments.nominalDibayar,
      metode: payments.metode,
      provider: payments.provider,
      referensi: payments.referensiProvider,
      status: payments.status,
      waktu: payments.diverifikasiPada,
    })
    .from(payments)
    .where(inArray(payments.invoiceId, invoices.map((inv) => inv.id)))
    // Pending (belum diverifikasi) di atas, lalu yang terbaru.
    .orderBy(desc(sql`${payments.diverifikasiPada} is null`), desc(payments.diverifikasiPada));

  return invoices.map((inv) => {
    const riwayat: PembayaranTercatat[] = bayar
      .filter((p) => p.invoiceId === inv.id)
      .map((p) => ({
        id: p.id,
        nominal: p.nominal,
        metode: p.metode,
        provider: p.provider,
        referensi: p.referensi,
        status: p.status,
        waktu: p.waktu?.toISOString(),
      }));
    const diterima = riwayat.filter((p) => p.status !== "pending" && p.waktu);
    return {
      ...inv,
      dibayar: diterima.reduce((total, p) => total + p.nominal, 0),
      pembayaranTerakhir: diterima[0],
      riwayat,
    };
  });
}
