// Kontrak data halaman Reminder Otomatis.
// Riwayat, statistik, tunggakan, dan antrian dari database. Tahap frontend: jadwal masih jadwal
// bawaan H-3/H/H+3 (disimpan di reminder_schedules pada tahap backend) — bentuk data tetap sama.

import { connection } from "next/server";

import { getDb } from "@/db";
import { getDaftarInvoice } from "@/lib/data/invoice";
import { getRiwayatReminder, getStatistikReminder, type RiwayatReminder, type StatistikReminder } from "@/lib/data/reminder";
import { getWorkspaceSession } from "@/lib/data/session";
import { antrianPengingat, JADWAL_BAWAAN, type AntrianPengingat, type JadwalPengingat } from "@/lib/reminder";
import type { InvoiceRow } from "@/lib/types";
import { hariIniWib } from "@/lib/waktu";

export type HalamanReminder = {
  hariIni: string;
  /** Periode (bulan kirim) untuk statistik, YYYY-MM. */
  periode: string;
  namaKos: string;
  otomatisAktif: boolean;
  jadwal: JadwalPengingat[];
  statistik: StatistikReminder;
  /** Tagihan jatuh tempo (semua periode) — bisa diingatkan manual sekarang. */
  menunggak: InvoiceRow[];
  /** Pengingat otomatis 7 hari ke depan. */
  antrian: AntrianPengingat[];
  riwayat: RiwayatReminder[];
};

export async function getHalamanReminder(): Promise<HalamanReminder> {
  await connection();
  const session = await getWorkspaceSession();
  const org = session.organization.id;
  const hariIni = hariIniWib();
  const periode = hariIni.slice(0, 7);
  const db = await getDb();

  const [statistik, semuaTagihan, riwayat] = await Promise.all([
    getStatistikReminder(db, org, periode),
    getDaftarInvoice(db, org, {}),
    getRiwayatReminder(db, org, { batas: 8 }),
  ]);
  const jadwal = JADWAL_BAWAAN;
  return {
    hariIni,
    periode,
    namaKos: session.organization.namaKos,
    otomatisAktif: true,
    jadwal,
    statistik,
    menunggak: semuaTagihan.filter((t) => t.status === "jatuh_tempo"),
    antrian: antrianPengingat(semuaTagihan, jadwal, hariIni),
    riwayat,
  };
}
