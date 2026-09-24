// Kontrak data halaman Kamar & Penghuni.

import { connection } from "next/server";

import { getDb } from "@/db";
import {
  getDaftarKamarPenghuni,
  getPenghuniNonaktif,
  type KamarPenghuni,
  type PenghuniNonaktif,
} from "@/lib/data/kamar";
import { getWorkspaceSession } from "@/lib/data/session";
import { hariIniWib } from "@/lib/waktu";

export type HalamanKamar = {
  hariIni: string;
  namaKos: string;
  kamar: KamarPenghuni[];
  nonaktif: PenghuniNonaktif[];
};

export async function getHalamanKamar(): Promise<HalamanKamar> {
  await connection();
  const session = await getWorkspaceSession();
  const db = await getDb();
  const [kamar, nonaktif] = await Promise.all([
    getDaftarKamarPenghuni(db, session.organization.id),
    getPenghuniNonaktif(db, session.organization.id),
  ]);
  return { hariIni: hariIniWib(), namaKos: session.organization.namaKos, kamar, nonaktif };
}
