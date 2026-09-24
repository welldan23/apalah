// Kontrak data halaman Pemantauan Pembayaran: tagihan satu periode beserta pembayaran yang
// sudah diterima. Periode kosong/tidak valid = periode berjalan (WIB).

import { connection } from "next/server";

import { getDb } from "@/db";
import { getDaftarTagihanPembayaran, type TagihanPembayaran } from "@/lib/data/pembayaran";
import { getPerluReview } from "@/lib/data/perlu-review";
import { getWorkspaceSession } from "@/lib/data/session";
import type { PembayaranPerluReview } from "@/lib/types";
import { hariIniWib, periodeValid } from "@/lib/waktu";

export type HalamanPembayaran = {
  hariIni: string;
  periode: string;
  periodeBerjalan: string;
  tagihan: TagihanPembayaran[];
  /** Semua tagihan Perlu Review lintas periode — untuk banner notifikasi. */
  perluReview: PembayaranPerluReview[];
};

export async function getHalamanPembayaran(periodeDiminta?: string): Promise<HalamanPembayaran> {
  await connection();

  const session = await getWorkspaceSession();
  const hariIni = hariIniWib();
  const periodeBerjalan = hariIni.slice(0, 7);
  const periode =
    periodeDiminta && periodeValid(periodeDiminta) ? periodeDiminta : periodeBerjalan;

  const db = await getDb();
  const [tagihan, perluReview] = await Promise.all([
    getDaftarTagihanPembayaran(db, session.organization.id, { periode }),
    getPerluReview(db, session.organization.id),
  ]);
  return { hariIni, periode, periodeBerjalan, tagihan, perluReview };
}
