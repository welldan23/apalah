// Tagihan + pembayaran yang sudah diterima — untuk halaman Pemantauan Pembayaran.
// "Dibayar" = uang yang diterima gateway (valid maupun tidak cocok); pembayaran pending
// belum dihitung. Status Lunas tetap hanya dari pembayaran valid.

import { desc, inArray } from "drizzle-orm";

import { schema, type Db } from "../../db/index.ts";
import { getDaftarInvoice } from "./invoice.ts";
import type { InvoiceRow, PaymentStatus } from "@/lib/types";

const { payments } = schema;

export type TagihanPembayaran = InvoiceRow & {
  dibayar: number;
  pembayaranTerakhir?: {
    nominal: number;
    metode: string;
    /** ISO datetime verifikasi gateway. */
    waktu: string;
    status: PaymentStatus;
  };
};

export async function getDaftarTagihanPembayaran(
  db: Db,
  organizationId: string,
  { periode }: { periode: string },
): Promise<TagihanPembayaran[]> {
  const invoices = await getDaftarInvoice(db, organizationId, { periode });
  if (invoices.length === 0) return [];

  const bayar = await db
    .select({
      invoiceId: payments.invoiceId,
      nominal: payments.nominalDibayar,
      metode: payments.metode,
      status: payments.status,
      waktu: payments.diverifikasiPada,
    })
    .from(payments)
    .where(inArray(payments.invoiceId, invoices.map((inv) => inv.id)))
    .orderBy(desc(payments.diverifikasiPada));

  return invoices.map((inv) => {
    const diterima = bayar.filter((p) => p.invoiceId === inv.id && p.status !== "pending" && p.waktu);
    const terakhir = diterima[0];
    return {
      ...inv,
      dibayar: diterima.reduce((total, p) => total + p.nominal, 0),
      pembayaranTerakhir: terakhir && {
        nominal: terakhir.nominal,
        metode: terakhir.metode,
        waktu: terakhir.waktu!.toISOString(),
        status: terakhir.status,
      },
    };
  });
}
