// Kontrak data halaman Tagihan Terjadwal: pengaturan tersimpan kos (atau bawaan), jumlah kamar
// terisi, dan total sewa — semuanya dari database.

import { connection } from "next/server";

import { getDb } from "@/db";
import { getPengaturanTagihanTerjadwal } from "@/lib/aksi/tagihan-terjadwal";
import { getRingkasanKos } from "@/lib/data/kos";
import { getWorkspaceSession } from "@/lib/data/session";
import type { PengaturanTagihanTerjadwal } from "@/lib/tagihan-terjadwal";
import { hariIniWib } from "@/lib/waktu";

export type HalamanTagihanTerjadwal = {
  hariIni: string;
  pengaturan: PengaturanTagihanTerjadwal;
  /** Kamar terisi yang akan ditagih otomatis. */
  jumlahKamar: number;
  /** Total harga sewa penghuni aktif per bulan. */
  totalSewa: number;
};

export async function getHalamanTagihanTerjadwal(): Promise<HalamanTagihanTerjadwal> {
  await connection();

  const session = await getWorkspaceSession();
  const db = await getDb();
  const [pengaturan, ringkasan] = await Promise.all([
    getPengaturanTagihanTerjadwal(db, session.organization.id),
    getRingkasanKos(db, session.organization.id),
  ]);
  const terisi = ringkasan?.kamar.daftar.filter((k) => k.status === "terisi") ?? [];

  return {
    hariIni: hariIniWib(),
    pengaturan,
    jumlahKamar: terisi.length,
    totalSewa: terisi.reduce((total, k) => total + (k.hargaSewaPenghuni ?? k.hargaSewa), 0),
  };
}
