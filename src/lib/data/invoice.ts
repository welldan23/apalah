// Daftar invoice dari database — dipakai tabel Status Bayar di Dashboard Kos dan
// endpoint GET /api/dashboard/invoices. Query selalu dibatasi satu organisasi.

import { and, eq, getTableColumns, ilike, or } from "drizzle-orm";

import { schema, type Db } from "../../db/index.ts";
import { PILIHAN_URUT, type UrutInvoice } from "../invoice.ts";
import { periodeValid, tanggalWib } from "../waktu.ts";
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

/**
 * Invoice satu periode (YYYY-MM) — atau semua periode bila `periode` kosong — opsional disaring
 * satu status dan kata kunci (nama penghuni / nomor kamar), urut dari yang paling perlu ditindak.
 */
export async function getDaftarInvoice(
  db: Db,
  organizationId: string,
  { periode, status, cari }: { periode?: string; status?: InvoiceStatus; cari?: string },
): Promise<InvoiceRow[]> {
  // Wildcard LIKE dari pengguna dianggap huruf biasa.
  const pola = cari?.trim() ? `%${cari.trim().replace(/[\\%_]/g, "\\$&")}%` : undefined;
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
        periode ? eq(invoices.periode, periode) : undefined,
        status ? eq(invoices.status, status) : undefined,
        pola ? or(ilike(tenants.nama, pola), ilike(rooms.nomorKamar, pola)) : undefined,
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

export type FilterDaftarInvoice = {
  /** "semua" = semua periode. */
  periode: string;
  status: InvoiceStatus | "semua";
  q: string;
  urut: UrutInvoice;
};

const MAKS_KATA_KUNCI = 100;

/**
 * Baca query `?periode=&status=&q=&urut=` endpoint daftar invoice. Periode kosong = periode
 * berjalan; nilai yang tidak dikenal ditolak dengan pesan galat.
 */
export function bacaFilterDaftarInvoice(
  params: URLSearchParams,
  periodeBerjalan: string,
): { filter: FilterDaftarInvoice } | { galat: string } {
  const periode = params.get("periode") || periodeBerjalan;
  const status = params.get("status") || "semua";
  const q = (params.get("q") ?? "").trim();
  const urut = params.get("urut") || "prioritas";

  if (periode !== "semua" && !periodeValid(periode)) {
    return { galat: "Periode harus berformat YYYY-MM atau \"semua\"." };
  }
  if (status !== "semua" && !isInvoiceStatus(status)) {
    return { galat: `Status tidak dikenal: ${status}` };
  }
  if (q.length > MAKS_KATA_KUNCI) {
    return { galat: `Kata kunci maksimal ${MAKS_KATA_KUNCI} karakter.` };
  }
  if (!PILIHAN_URUT.some((u) => u.value === urut)) {
    return { galat: `Urutan tidak dikenal: ${urut}` };
  }
  return { filter: { periode, status, q, urut: urut as UrutInvoice } };
}
