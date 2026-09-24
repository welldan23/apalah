// Rekap pemasukan satu periode dari database — dipakai kartu Pemasukan Bulan Ini di
// Dashboard Kos dan endpoint GET /api/dashboard/pemasukan.
// Uang masuk = pembayaran berstatus valid (hasil webhook gateway) untuk invoice periode
// tersebut; pembayaran pending/tidak cocok tidak dihitung. Angka dihitung di database.

import { and, desc, eq, isNotNull, sql } from "drizzle-orm";

import { schema, type Db } from "../../db/index.ts";
import type { InvoiceStatus, RekapPemasukan, RekapTagihan } from "@/lib/types";

const { invoices, payments, rooms, tenants } = schema;

const JUMLAH_TERAKHIR = 3;

export async function getRekapPemasukan(
  db: Db,
  organizationId: string,
  { periode }: { periode: string },
): Promise<RekapPemasukan> {
  const invoicePeriodeIni = and(
    eq(invoices.organizationId, organizationId),
    eq(invoices.periode, periode),
  );
  const pembayaranValid = and(invoicePeriodeIni, eq(payments.status, "valid"));

  const [perStatus, [total], terakhir] = await Promise.all([
    db
      .select({
        status: invoices.status,
        jumlah: sql<number>`count(*)`.mapWith(Number),
        nominal: sql<number>`coalesce(sum(${invoices.nominal}), 0)`.mapWith(Number),
      })
      .from(invoices)
      .where(invoicePeriodeIni)
      .groupBy(invoices.status),
    db
      .select({
        nominal: sql<number>`coalesce(sum(${payments.nominalDibayar}), 0)`.mapWith(Number),
        jumlah: sql<number>`count(*)`.mapWith(Number),
      })
      .from(payments)
      .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
      .where(pembayaranValid),
    db
      .select({
        id: payments.id,
        invoiceId: payments.invoiceId,
        nominalDibayar: payments.nominalDibayar,
        metode: payments.metode,
        diverifikasiPada: payments.diverifikasiPada,
        namaPenghuni: tenants.nama,
        nomorKamar: rooms.nomorKamar,
      })
      .from(payments)
      .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
      .innerJoin(tenants, eq(tenants.id, invoices.tenantId))
      .innerJoin(rooms, eq(rooms.id, invoices.roomId))
      .where(and(pembayaranValid, isNotNull(payments.diverifikasiPada)))
      .orderBy(desc(payments.diverifikasiPada))
      .limit(JUMLAH_TERAKHIR),
  ]);

  const rekap = (status: InvoiceStatus): RekapTagihan => {
    const baris = perStatus.find((r) => r.status === status);
    return { jumlah: baris?.jumlah ?? 0, nominal: baris?.nominal ?? 0 };
  };

  return {
    tagihan: {
      total: {
        jumlah: perStatus.reduce((n, r) => n + r.jumlah, 0),
        nominal: perStatus.reduce((n, r) => n + r.nominal, 0),
      },
      lunas: rekap("lunas"),
      menunggu: rekap("menunggu"),
      jatuhTempo: rekap("jatuh_tempo"),
      perluReview: rekap("perlu_review"),
    },
    pemasukan: {
      bulanIni: total.nominal,
      jumlahPembayaran: total.jumlah,
      terakhir: terakhir.map((p) => ({ ...p, diverifikasiPada: p.diverifikasiPada!.toISOString() })),
    },
  };
}
