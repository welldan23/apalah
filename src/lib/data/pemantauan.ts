// Kontrak data halaman Pemantauan Pembayaran: tagihan satu periode beserta pembayaran yang
// sudah diterima. Periode kosong/tidak valid = periode berjalan (WIB).

import { connection } from "next/server";

import { getDb } from "@/db";
import { getDaftarTagihanPembayaran, type TagihanPembayaran } from "@/lib/data/pembayaran";
import { getWorkspaceSession } from "@/lib/data/session";
import { hariIniWib, periodeValid } from "@/lib/waktu";

export type HalamanPembayaran = {
  hariIni: string;
  periode: string;
  periodeBerjalan: string;
  tagihan: TagihanPembayaran[];
};

export async function getHalamanPembayaran(periodeDiminta?: string): Promise<HalamanPembayaran> {
  await connection();

  const session = await getWorkspaceSession();
  const hariIni = hariIniWib();
  const periodeBerjalan = hariIni.slice(0, 7);
  const periode =
    periodeDiminta && periodeValid(periodeDiminta) ? periodeDiminta : periodeBerjalan;

  const tagihan = await getDaftarTagihanPembayaran(await getDb(), session.organization.id, {
    periode,
  });
  return { hariIni, periode, periodeBerjalan, tagihan };
}
