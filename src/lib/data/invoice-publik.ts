// Data halaman invoice publik (/invoice/[token]) — dibuka penyewa tanpa login.
// Hanya berisi data satu invoice milik token tersebut; tidak ada data kos atau penyewa lain.

import { asc, eq, sql } from "drizzle-orm";

import { schema, type Db } from "../../db/index.ts";
import { tanggalWib } from "../waktu.ts";
import type { InvoiceStatus } from "@/lib/types";

const { invoiceItems, invoices, organizations, payments, rooms, tenants, users } = schema;

export type PembayaranPublik = {
  /** ISO datetime pembayaran dicatat. */
  waktu: string;
  metode: string;
  nominal: number;
  /** pending = diproses gateway; valid = diterima; tidak_cocok = nominal beda, diperiksa pemilik kos. */
  status: "pending" | "valid" | "tidak_cocok";
};

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
  /** Komponen tagihan (sewa kamar di atas); totalnya sama dengan nominal. */
  rincian: { label: string; nominal: number }[];
  jatuhTempo: string;
  status: InvoiceStatus;
  diterbitkanPada: string;
  dibayarPada?: string;
  /** Riwayat pembayaran tagihan ini, terlama di atas. */
  pembayaran: PembayaranPublik[];
  /** Uang yang sudah masuk (diterima + sedang diperiksa) — sama dengan dasar pencocokan nominal. */
  sudahDiterima: number;
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

  const rincian = await db
    .select({ label: invoiceItems.label, nominal: invoiceItems.nominal })
    .from(invoiceItems)
    .innerJoin(invoices, eq(invoices.id, invoiceItems.invoiceId))
    .where(eq(invoices.tokenPublik, token))
    .orderBy(sql`${invoiceItems.label} <> 'Sewa kamar'`, asc(invoiceItems.label));

  const bayar = await db
    .select({ waktu: payments.dibuatPada, metode: payments.metode, nominal: payments.nominalDibayar, status: payments.status })
    .from(payments)
    .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
    .where(eq(invoices.tokenPublik, token))
    .orderBy(asc(payments.dibuatPada));

  return {
    ...inv,
    rincian: rincian.length > 0 ? rincian : [{ label: "Sewa kamar", nominal: inv.nominal }],
    nomorInvoice: `INV-${inv.periode.replace("-", "")}-${inv.nomorKamar}`,
    diterbitkanPada: tanggalWib(inv.diterbitkanPada),
    dibayarPada: inv.dibayarPada ? tanggalWib(inv.dibayarPada) : undefined,
    pembayaran: bayar.map((b) => ({ ...b, waktu: b.waktu.toISOString() })),
    sudahDiterima: bayar.filter((b) => b.status !== "pending").reduce((total, b) => total + b.nominal, 0),
  };
}
