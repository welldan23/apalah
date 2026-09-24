// Notifikasi ke owner/admin saat tagihan ditandai Perlu review (nominal pembayaran tidak cocok):
// WhatsApp berisi uang diterima vs tagihan + selisih, dan tercatat di riwayat chat Kosta mereka.

import { and, eq, inArray, sql } from "drizzle-orm";

import { schema, type Db } from "../../db/index.ts";
import { formatPeriode, formatRupiah } from "../format.ts";
import { catatPesan, pastikanPercakapan } from "../kosta/riwayat.ts";
import type { PengirimWhatsApp } from "../whatsapp/index.ts";

const { invoices, members, organizations, payments, rooms, tenants, users } = schema;

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
  const selisih = diterima - inv.nominal;

  const pengelola = await db
    .select({ nomorWa: users.nomorWa })
    .from(members)
    .innerJoin(users, eq(users.id, members.userId))
    .where(
      and(
        eq(members.organizationId, inv.organizationId),
        eq(members.status, "aktif"),
        inArray(members.peran, ["owner", "admin"]),
        eq(users.nomorWaTerverifikasi, true),
      ),
    );

  const teks = [
    `Perlu diperiksa — ${inv.namaKos}`,
    `Pembayaran kamar ${inv.nomorKamar} (${inv.namaPenghuni}) periode ${formatPeriode(inv.periode)}: diterima ${formatRupiah(diterima)} dari tagihan ${formatRupiah(inv.nominal)} (${selisih < 0 ? "kurang" : "lebih"} ${formatRupiah(Math.abs(selisih))}).`,
    "Status tidak diubah jadi Lunas sampai kamu memeriksanya.",
    `Cek: ${baseUrl}/pembayaran?status=perlu_review`,
  ].join("\n");

  let terkirim = 0;
  for (const { nomorWa } of pengelola) {
    const { ok } = await wa.kirim({ ke: nomorWa, teks }).catch(() => ({ ok: false }) as const);
    if (ok) terkirim += 1;
    const percakapan = await pastikanPercakapan(db, nomorWa);
    await catatPesan(db, { conversationId: percakapan.id, organizationId: inv.organizationId, arah: "keluar", isi: teks });
  }
  return terkirim;
}
