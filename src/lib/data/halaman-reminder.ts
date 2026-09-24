// Kontrak data halaman Reminder Otomatis.
// Riwayat, statistik, tunggakan, dan antrian dari database. Tahap frontend: jadwal masih jadwal
// bawaan H-3/H/H+3 (disimpan di reminder_schedules pada tahap backend) — bentuk data tetap sama.

import { connection } from "next/server";

import { getDb } from "@/db";
import { getDaftarInvoice } from "@/lib/data/invoice";
import {
  getKandidatReminder,
  getRiwayatReminder,
  getStatistikReminder,
  type KandidatReminder,
  type RiwayatReminder,
  type StatistikReminder,
} from "@/lib/data/reminder";
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

export type HalamanJadwalPengingat = Pick<HalamanReminder, "hariIni" | "otomatisAktif" | "jadwal" | "antrian">;

/** Halaman Jadwal pengingat: jadwal (tahap frontend: bawaan) + antrian 7 hari untuk tiap jadwal. */
export async function getHalamanJadwalPengingat(): Promise<HalamanJadwalPengingat> {
  const { hariIni, otomatisAktif, jadwal, antrian } = await getHalamanReminder();
  return { hariIni, otomatisAktif, jadwal, antrian };
}

export type HalamanKirimReminder = {
  hariIni: string;
  periode: string;
  namaKos: string;
  /** Waktu server (ISO) — acuan jeda 24 jam antar pengingat. */
  sekarang: string;
  kandidat: KandidatReminder[];
};

/** Halaman Kirim reminder massal: tagihan belum lunas + kapan terakhir penyewanya diingatkan. */
export async function getHalamanKirimReminder(): Promise<HalamanKirimReminder> {
  await connection();
  const session = await getWorkspaceSession();
  const hariIni = hariIniWib();
  return {
    hariIni,
    periode: hariIni.slice(0, 7),
    namaKos: session.organization.namaKos,
    sekarang: new Date().toISOString(),
    kandidat: await getKandidatReminder(await getDb(), session.organization.id),
  };
}
