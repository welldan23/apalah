// Kontrak data halaman Kamar & Penghuni.

import { connection } from "next/server";

import { getDb } from "@/db";
import { getDaftarKamarPenghuni, type KamarPenghuni } from "@/lib/data/kamar";
import { getWorkspaceSession } from "@/lib/data/session";
import { hariIniWib } from "@/lib/waktu";

export type HalamanKamar = {
  hariIni: string;
  namaKos: string;
  kamar: KamarPenghuni[];
};

export async function getHalamanKamar(): Promise<HalamanKamar> {
  await connection();
  const session = await getWorkspaceSession();
  return {
    hariIni: hariIniWib(),
    namaKos: session.organization.namaKos,
    kamar: await getDaftarKamarPenghuni(await getDb(), session.organization.id),
  };
}
