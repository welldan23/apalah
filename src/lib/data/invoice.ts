// Daftar invoice dari database — dipakai tabel Status Bayar di Dashboard Kos dan
// endpoint GET /api/dashboard/invoices. Query selalu dibatasi satu organisasi.

import { and, eq, getTableColumns } from "drizzle-orm";

import { schema, type Db } from "../../db/index.ts";
import { tanggalWib } from "../waktu.ts";
import type { InvoiceRow, InvoiceStatus } from "@/lib/types";

const { invoices, rooms, tenants } = schema;

export function isInvoiceStatus(value: string): value is InvoiceStatus {
  return (schema.statusInvoiceEnum.enumValues as string[]).includes(value);
}

// Urutan tampil: yang perlu ditindak dulu, yang sudah beres belakangan.
const URUTAN_STATUS: Record<InvoiceStatus, number> = {
  jatuh_tempo: 0,
  perlu_review: 1,
  menunggu: 2,
  terkirim: 3,
  draft: 4,
  lunas: 5,
};

function urutkanInvoice(a: InvoiceRow, b: InvoiceRow) {
  const beda = URUTAN_STATUS[a.status] - URUTAN_STATUS[b.status];
  if (beda !== 0) return beda;
  if (a.status === "lunas") {
    return (b.dibayarPada ?? "").localeCompare(a.dibayarPada ?? "");
  }
  return a.jatuhTempo.localeCompare(b.jatuhTempo);
}

/** Invoice satu periode (YYYY-MM), opsional disaring satu status, urut dari yang paling perlu ditindak. */
export async function getDaftarInvoice(
  db: Db,
  organizationId: string,
  { periode, status }: { periode: string; status?: InvoiceStatus },
): Promise<InvoiceRow[]> {
  const baris = await db
    .select({
      ...getTableColumns(invoices),
      namaPenghuni: tenants.nama,
      nomorKamar: rooms.nomorKamar,
    })
    .from(invoices)
    .innerJoin(tenants, eq(tenants.id, invoices.tenantId))
    .innerJoin(rooms, eq(rooms.id, invoices.roomId))
    .where(
      and(
        eq(invoices.organizationId, organizationId),
        eq(invoices.periode, periode),
        status ? eq(invoices.status, status) : undefined,
      ),
    );

  return baris
    .map((inv) => ({
      ...inv,
      diterbitkanPada: tanggalWib(inv.diterbitkanPada),
      dibayarPada: inv.dibayarPada ? tanggalWib(inv.dibayarPada) : undefined,
    }))
    .sort(urutkanInvoice);
}
