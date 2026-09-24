// Kontrak data halaman Kamar kosong.

import { connection } from "next/server";

import { getDb } from "@/db";
import {
  getDaftarKamarPenghuni,
  getKamarKosong,
  getKamarNonaktif,
  type KamarKosong,
  type KamarNonaktif,
} from "@/lib/data/kamar";
import { getWorkspaceSession } from "@/lib/data/session";
import { hariIniWib } from "@/lib/waktu";

export type HalamanKamarKosong = {
  hariIni: string;
  namaKos: string;
  totalKamar: number;
  kamar: KamarKosong[];
  /** Kamar yang dinonaktifkan (tidak ditawarkan). */
  nonaktif: KamarNonaktif[];
};

export async function getHalamanKamarKosong(): Promise<HalamanKamarKosong> {
  await connection();
  const session = await getWorkspaceSession();
  const db = await getDb();
  const [kamar, semua, nonaktif] = await Promise.all([
    getKamarKosong(db, session.organization.id),
    getDaftarKamarPenghuni(db, session.organization.id),
    getKamarNonaktif(db, session.organization.id),
  ]);
  return { hariIni: hariIniWib(), namaKos: session.organization.namaKos, totalKamar: semua.length, kamar, nonaktif };
}
