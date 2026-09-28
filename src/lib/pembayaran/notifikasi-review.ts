// Notifikasi ke owner/admin saat tagihan ditandai Perlu review (nominal pembayaran tidak cocok):
// WhatsApp berisi uang diterima vs tagihan + selisih, dan tercatat di riwayat chat Kosta mereka.

import { and, eq, inArray, sql } from "drizzle-orm";

import { schema, type Db } from "../../db/index.ts";
import { pesanPerluReview, templatePerluReview } from "../pesan.ts";
import type { PengirimWhatsApp } from "../whatsapp/index.ts";
import { kirimKePengelola } from "./notifikasi-pengelola.ts";

const { invoices, organizations, payments, rooms, tenants } = schema;

/** Jumlah pengelola yang berhasil dikirimi; 0 bila tagihan tidak (lagi) Perlu review. */
export async function kirimNotifikasiPerluReview(
  db: Db,
  invoiceId: string,
  { wa, baseUrl }: { wa: PengirimWhatsApp; baseUrl: string },
) {
  const [inv] = await db
    .select({
      organizationId: invoices.organizationId,
      status: invoices.status,
      periode: invoices.periode,
      nominal: invoices.nominal,
      namaKos: organizations.namaKos,
      namaPenghuni: tenants.nama,
      nomorKamar: rooms.nomorKamar,
    })
    .from(invoices)
    .innerJoin(organizations, eq(organizations.id, invoices.organizationId))
    .innerJoin(tenants, eq(tenants.id, invoices.tenantId))
    .innerJoin(rooms, eq(rooms.id, invoices.roomId))
    .where(eq(invoices.id, invoiceId));
  if (!inv || inv.status !== "perlu_review") return 0;

  const [{ diterima }] = await db
    .select({ diterima: sql<number>`coalesce(sum(${payments.nominalDibayar}), 0)`.mapWith(Number) })
    .from(payments)
    .where(and(eq(payments.invoiceId, invoiceId), inArray(payments.status, ["valid", "tidak_cocok"])));

  const data = { ...inv, diterima };
  return kirimKePengelola(db, wa, {
    organizationId: inv.organizationId,
    teks: pesanPerluReview(data, `${baseUrl}/pembayaran?status=perlu_review`),
    template: templatePerluReview(data),
    jenis: "perlu_review",
    referensiId: invoiceId,
  });
}
