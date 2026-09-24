// Data pengingat bayar dari tabel reminders — riwayat & statistik per kos.
// Pesan non-pengingat (kirim tagihan, konfirmasi lunas) tidak ikut dihitung.

import { and, desc, eq, gte, lt, notInArray, sql } from "drizzle-orm";

import { schema, type Db } from "../../db/index.ts";
import { periodeBerikutnya } from "../format.ts";
import { JENIS_BUKAN_PENGINGAT } from "../reminder.ts";

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
