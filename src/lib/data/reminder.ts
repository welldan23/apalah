// Data pengingat bayar dari tabel reminders — riwayat & statistik per kos.
// Pesan non-pengingat (kirim tagihan, konfirmasi lunas) tidak ikut dihitung.

import { and, desc, eq, gte, inArray, lt, max, notInArray, sql } from "drizzle-orm";

import { schema, type Db } from "../../db/index.ts";
import { periodeBerikutnya } from "../format.ts";
import { JENIS_BUKAN_PENGINGAT } from "../reminder.ts";
import { getDaftarInvoice } from "./invoice.ts";
import type { InvoiceRow } from "@/lib/types";

const { invoices, reminders, rooms, tenants } = schema;

export type RiwayatReminder = {
  id: string;
  jenis: string;
  status: "terkirim" | "gagal";
  /** ISO datetime. */
  terkirimPada: string;
  nomorKamar: string;
  namaPenghuni: string;
  periode: string;
  nominal: number;
};

const awalBulanWib = (periode: string) => new Date(`${periode}-01T00:00:00+07:00`);

/** Pengingat terbaru di atas; `periode` membatasi ke bulan kirim (WIB). */
export async function getRiwayatReminder(
  db: Db,
  organizationId: string,
  { periode, batas = 50 }: { periode?: string; batas?: number } = {},
): Promise<RiwayatReminder[]> {
  const baris = await db
    .select({
      id: reminders.id,
      jenis: reminders.jenis,
      status: reminders.status,
      terkirimPada: reminders.terkirimPada,
      nomorKamar: rooms.nomorKamar,
      namaPenghuni: tenants.nama,
      periode: invoices.periode,
      nominal: invoices.nominal,
    })
    .from(reminders)
    .innerJoin(invoices, eq(invoices.id, reminders.invoiceId))
    .innerJoin(tenants, eq(tenants.id, reminders.tenantId))
    .innerJoin(rooms, eq(rooms.id, invoices.roomId))
    .where(
      and(
        eq(reminders.organizationId, organizationId),
        notInArray(reminders.jenis, [...JENIS_BUKAN_PENGINGAT]),
        periode ? gte(reminders.terkirimPada, awalBulanWib(periode)) : undefined,
        periode ? lt(reminders.terkirimPada, awalBulanWib(periodeBerikutnya(periode))) : undefined,
      ),
    )
    .orderBy(desc(reminders.terkirimPada))
    .limit(batas);
  return baris.map((b) => ({ ...b, terkirimPada: b.terkirimPada.toISOString() }));
}

export type StatistikReminder = { terkirim: number; gagal: number; penyewa: number };

/** Jumlah pengingat terkirim/gagal dan penyewa yang diingatkan di satu bulan kirim (WIB). */
export async function getStatistikReminder(db: Db, organizationId: string, periode: string): Promise<StatistikReminder> {
  const [s] = await db
    .select({
      terkirim: sql<number>`count(*) filter (where ${reminders.status} = 'terkirim')`.mapWith(Number),
      gagal: sql<number>`count(*) filter (where ${reminders.status} = 'gagal')`.mapWith(Number),
      penyewa: sql<number>`count(distinct ${reminders.tenantId}) filter (where ${reminders.status} = 'terkirim')`.mapWith(Number),
    })
    .from(reminders)
    .where(
      and(
        eq(reminders.organizationId, organizationId),
        notInArray(reminders.jenis, [...JENIS_BUKAN_PENGINGAT]),
        gte(reminders.terkirimPada, awalBulanWib(periode)),
        lt(reminders.terkirimPada, awalBulanWib(periodeBerikutnya(periode))),
      ),
    );
  return s;
}

export type KandidatReminder = InvoiceRow & {
  /** ISO datetime pesan terakhir yang terkirim ke penyewa untuk tagihan ini. */
  terakhirDiingatkan?: string;
};

/**
 * Tagihan yang belum lunas (menunggu, terkirim, jatuh tempo) — kandidat penerima reminder massal —
 * beserta kapan terakhir penyewanya dihubungi soal tagihan itu.
 */
export async function getKandidatReminder(db: Db, organizationId: string): Promise<KandidatReminder[]> {
  const tagihan = (await getDaftarInvoice(db, organizationId, {})).filter((t) =>
    ["menunggu", "terkirim", "jatuh_tempo"].includes(t.status),
  );
  if (tagihan.length === 0) return [];
  const terakhir = await db
    .select({ invoiceId: reminders.invoiceId, waktu: max(reminders.terkirimPada) })
    .from(reminders)
    .where(
      and(
        eq(reminders.organizationId, organizationId),
        eq(reminders.status, "terkirim"),
        notInArray(reminders.jenis, ["konfirmasi_lunas"]),
        inArray(
          reminders.invoiceId,
          tagihan.map((t) => t.id),
        ),
      ),
    )
    .groupBy(reminders.invoiceId);
  const peta = new Map(terakhir.map((r) => [r.invoiceId, r.waktu]));
  return tagihan.map((t) => {
    const waktu = peta.get(t.id);
    return waktu ? { ...t, terakhirDiingatkan: waktu.toISOString() } : t;
  });
}
