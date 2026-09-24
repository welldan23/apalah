// Service penyusun isi pesan pengingat bayar — satu sumber untuk kirim manual, konfirmasi draft
// Kosta, dan pengingat otomatis. Angka, tanggal, dan link invoice selalu dari database; template
// mengikuti waktu: sebelum / di hari jatuh tempo, atau sudah lewat.

import { and, asc, eq, inArray } from "drizzle-orm";

import { schema, type Db } from "../../db/index.ts";
import { pesanPengingat } from "../pesan.ts";
import { STATUS_BISA_DIINGATKAN } from "../reminder.ts";
import { GalatAksi } from "./galat.ts";

const { invoices, organizations, rooms, tenants } = schema;

export type PesanReminder = {
  invoiceId: string;
  tenantId: string;
  nomorKamar: string;
  namaPenghuni: string;
  /** Tujuan WhatsApp (format 62…). */
  nomorWa: string;
  teks: string;
};

/**
 * Susun pesan pengingat untuk tagihan-tagihan satu kos, urut nomor kamar.
 * Galat 404 bila ada tagihan yang bukan milik kos ini; 409 bila ada yang tidak boleh diingatkan
 * (draft, lunas, perlu review, dibatalkan).
 */
export async function susunPesanReminder(
  db: Db,
  organizationId: string,
  invoiceIds: string[],
  { baseUrl, hariIni }: { baseUrl: string; hariIni: string },
): Promise<PesanReminder[]> {
  if (invoiceIds.length === 0) return [];
  const [kos] = await db
    .select({ namaKos: organizations.namaKos })
    .from(organizations)
    .where(eq(organizations.id, organizationId));
  if (!kos) throw new GalatAksi("Kos tidak ditemukan.", 404);

  const tagihan = await db
    .select({
      id: invoices.id,
      tenantId: invoices.tenantId,
      periode: invoices.periode,
      nominal: invoices.nominal,
      jatuhTempo: invoices.jatuhTempo,
      status: invoices.status,
      tokenPublik: invoices.tokenPublik,
      namaPenghuni: tenants.nama,
      nomorWa: tenants.nomorWa,
      nomorKamar: rooms.nomorKamar,
    })
    .from(invoices)
    .innerJoin(tenants, eq(tenants.id, invoices.tenantId))
    .innerJoin(rooms, eq(rooms.id, invoices.roomId))
    .where(and(eq(invoices.organizationId, organizationId), inArray(invoices.id, invoiceIds)))
    .orderBy(asc(rooms.nomorKamar));

  if (tagihan.length !== new Set(invoiceIds).size) throw new GalatAksi("Sebagian tagihan tidak ditemukan.", 404);
  const bisa: readonly string[] = STATUS_BISA_DIINGATKAN;
  const ditolak = tagihan.filter((t) => !bisa.includes(t.status));
  if (ditolak.length > 0) {
    const kamar = ditolak.map((t) => t.nomorKamar).join(", ");
    throw new GalatAksi(`Hanya tagihan yang belum dibayar yang bisa diingatkan (kamar ${kamar}).`, 409);
  }

  return tagihan.map((t) => ({
    invoiceId: t.id,
    tenantId: t.tenantId,
    nomorKamar: t.nomorKamar,
    namaPenghuni: t.namaPenghuni,
    nomorWa: t.nomorWa,
    teks: pesanPengingat(t, kos.namaKos, hariIni, `${baseUrl}/invoice/${t.tokenPublik}`),
  }));
}
