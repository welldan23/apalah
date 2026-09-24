// Kontrak data halaman Tagihan Terjadwal.
// Tahap frontend: pengaturan masih bawaan (belum tersimpan di server); jumlah kamar terisi
// dan total sewa sudah dari database.

import { connection } from "next/server";

import { getDb } from "@/db";
import { getRingkasanKos } from "@/lib/data/kos";
import { getWorkspaceSession } from "@/lib/data/session";
import { PENGATURAN_BAWAAN, type PengaturanTagihanTerjadwal } from "@/lib/tagihan-terjadwal";
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
  const ringkasan = await getRingkasanKos(await getDb(), session.organization.id);
  const terisi = ringkasan?.kamar.daftar.filter((k) => k.status === "terisi") ?? [];

  return {
    hariIni: hariIniWib(),
    pengaturan: PENGATURAN_BAWAAN,
    jumlahKamar: terisi.length,
    totalSewa: terisi.reduce((total, k) => total + (k.hargaSewaPenghuni ?? k.hargaSewa), 0),
  };
}
