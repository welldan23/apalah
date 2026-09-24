// Konfirmasi otomatis ke penyewa begitu tagihannya Lunas (dari webhook pembayaran yang valid):
// pesan WhatsApp berisi nominal & link invoice sebagai bukti, dicatat di riwayat pesan (reminders).

import { eq } from "drizzle-orm";

import { schema, type Db } from "../../db/index.ts";
import { pesanLunas } from "../pesan.ts";
import { kirimAman, type PengirimWhatsApp } from "../whatsapp/index.ts";

const { invoices, organizations, reminders, rooms, tenants } = schema;

/** true bila pesan terkirim; tagihan yang (sudah) tidak lunas tidak dikonfirmasi. */
export async function kirimKonfirmasiLunas(
  db: Db,
  invoiceId: string,
  { wa, baseUrl }: { wa: PengirimWhatsApp; baseUrl: string },
) {
  const [inv] = await db
    .select({
      id: invoices.id,
      organizationId: invoices.organizationId,
      tenantId: invoices.tenantId,
      status: invoices.status,
      periode: invoices.periode,
      nominal: invoices.nominal,
      jatuhTempo: invoices.jatuhTempo,
      tokenPublik: invoices.tokenPublik,
      namaKos: organizations.namaKos,
      namaPenghuni: tenants.nama,
      nomorWa: tenants.nomorWa,
      nomorKamar: rooms.nomorKamar,
    })
    .from(invoices)
    .innerJoin(organizations, eq(organizations.id, invoices.organizationId))
    .innerJoin(tenants, eq(tenants.id, invoices.tenantId))
    .innerJoin(rooms, eq(rooms.id, invoices.roomId))
    .where(eq(invoices.id, invoiceId));
  if (!inv || inv.status !== "lunas") return false;

  const teks = pesanLunas(inv, inv.namaKos, `${baseUrl}/invoice/${inv.tokenPublik}`);
  const kirim = await kirimAman(wa, { ke: inv.nomorWa, teks });
  await db.insert(reminders).values({
    organizationId: inv.organizationId,
    invoiceId: inv.id,
    tenantId: inv.tenantId,
    jenis: "konfirmasi_lunas",
    kanal: "whatsapp",
    status: kirim.ok ? "terkirim" : "gagal",
    galat: kirim.ok ? null : kirim.galat,
  });
  return kirim.ok;
}
