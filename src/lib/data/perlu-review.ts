// Tagihan berstatus Perlu Review (nominal bayar tidak cocok) di semua periode — untuk banner
// notifikasi di Dashboard dan halaman Pembayaran.

import { and, asc, eq, sql } from "drizzle-orm";

import { schema, type Db } from "../../db/index.ts";
import type { PembayaranPerluReview } from "@/lib/types";

const { invoices, payments, rooms, tenants } = schema;

export async function getPerluReview(db: Db, organizationId: string): Promise<PembayaranPerluReview[]> {
  return db
    .select({
      invoiceId: invoices.id,
      nomorKamar: rooms.nomorKamar,
      namaPenghuni: tenants.nama,
      periode: invoices.periode,
      nominal: invoices.nominal,
      dibayar: sql<number>`coalesce(sum(${payments.nominalDibayar}) filter (where ${payments.status} <> 'pending'), 0)`.mapWith(Number),
    })
    .from(invoices)
    .innerJoin(tenants, eq(tenants.id, invoices.tenantId))
    .innerJoin(rooms, eq(rooms.id, invoices.roomId))
    .leftJoin(payments, eq(payments.invoiceId, invoices.id))
    .where(and(eq(invoices.organizationId, organizationId), eq(invoices.status, "perlu_review")))
    .groupBy(invoices.id, rooms.nomorKamar, tenants.nama)
    .orderBy(asc(invoices.periode), asc(rooms.nomorKamar));
}
