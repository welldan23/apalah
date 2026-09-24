// Data halaman invoice publik (/invoice/[token]) — dibuka penyewa tanpa login.
// Hanya berisi data satu invoice milik token tersebut; tidak ada data kos atau penyewa lain.

import { eq } from "drizzle-orm";

import { schema, type Db } from "../../db/index.ts";
import { tanggalWib } from "../waktu.ts";
import type { InvoiceStatus } from "@/lib/types";

const { invoices, organizations, rooms, tenants, users } = schema;

export type InvoicePublik = {
  nomorInvoice: string;
  namaKos: string;
  alamatKos: string;
  /** Nomor WhatsApp pemilik untuk dihubungi penyewa. */
  nomorWaPemilik: string;
  namaPenghuni: string;
  nomorKamar: string;
  tipeKamar: string;
  periode: string;
  nominal: number;
  jatuhTempo: string;
  status: InvoiceStatus;
  diterbitkanPada: string;
  dibayarPada?: string;
};

/** Token link invoice: base64url acak (atau token contoh "demo-…"). */
export function tokenValid(token: string) {
  return /^[A-Za-z0-9_-]{8,64}$/.test(token);
}

/** null bila token tidak valid atau tidak ditemukan. */
export async function getInvoicePublik(db: Db, token: string): Promise<InvoicePublik | null> {
  if (!tokenValid(token)) return null;

  const [inv] = await db
    .select({
      periode: invoices.periode,
      nominal: invoices.nominal,
      jatuhTempo: invoices.jatuhTempo,
      status: invoices.status,
      diterbitkanPada: invoices.diterbitkanPada,
      dibayarPada: invoices.dibayarPada,
      namaKos: organizations.namaKos,
      alamatKos: organizations.alamat,
      nomorWaPemilik: users.nomorWa,
      namaPenghuni: tenants.nama,
      nomorKamar: rooms.nomorKamar,
      tipeKamar: rooms.tipe,
    })
    .from(invoices)
    .innerJoin(organizations, eq(organizations.id, invoices.organizationId))
    .innerJoin(users, eq(users.id, organizations.ownerId))
    .innerJoin(tenants, eq(tenants.id, invoices.tenantId))
    .innerJoin(rooms, eq(rooms.id, invoices.roomId))
    .where(eq(invoices.tokenPublik, token));
  if (!inv) return null;

  return {
    ...inv,
    nomorInvoice: `INV-${inv.periode.replace("-", "")}-${inv.nomorKamar}`,
    diterbitkanPada: tanggalWib(inv.diterbitkanPada),
    dibayarPada: inv.dibayarPada ? tanggalWib(inv.dibayarPada) : undefined,
  };
}
