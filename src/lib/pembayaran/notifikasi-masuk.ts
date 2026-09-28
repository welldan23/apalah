// Kabar ke owner/admin begitu tagihan Lunas lewat payment gateway: siapa, periode, nominal, dan cara
// bayarnya — owner tidak perlu mengecek mutasi atau mencatat apa pun.

import { and, desc, eq } from "drizzle-orm";

import { schema, type Db } from "../../db/index.ts";
import { pesanPembayaranMasuk, templatePembayaranMasuk } from "../pesan.ts";
import type { PengirimWhatsApp } from "../whatsapp/index.ts";
import { kirimKePengelola } from "./notifikasi-pengelola.ts";

const { invoices, organizations, payments, rooms, tenants } = schema;

/** Jumlah pengelola yang berhasil dikirimi; 0 bila tagihan tidak (lagi) Lunas. */
export async function kirimNotifikasiPembayaranMasuk(
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
  if (!inv || inv.status !== "lunas") return 0;

  const [terakhir] = await db
    .select({ metode: payments.metode })
    .from(payments)
    .where(and(eq(payments.invoiceId, invoiceId), eq(payments.status, "valid")))
    .orderBy(desc(payments.diverifikasiPada))
    .limit(1);
  const data = { ...inv, metode: terakhir?.metode ?? "pembayaran online" };
  return kirimKePengelola(db, wa, {
    organizationId: inv.organizationId,
    teks: pesanPembayaranMasuk(data, `${baseUrl}/pembayaran`),
    template: templatePembayaranMasuk(data),
    jenis: "pembayaran_masuk",
    referensiId: invoiceId,
  });
}
