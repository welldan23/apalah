// Kontrak data halaman Tambah kos & kamar: kos aktif, nomor kamar yang sudah dipakai, dan
// tipe kamar yang ada (untuk mengisi baris awal wizard).

import { connection } from "next/server";

import { getDb } from "@/db";
import { getDaftarKamarPenghuni } from "@/lib/data/kamar";
import { getWorkspaceSession } from "@/lib/data/session";
import type { RencanaTipe } from "@/lib/rencana-kamar";

export type HalamanTambahKamar = {
  namaKos: string;
  alamatKos: string;
  nomorKamarAda: string[];
  /** Satu baris per tipe yang sudah ada (jumlah 1), sebagai titik awal. */
  tipeAda: RencanaTipe[];
};

export async function getHalamanTambahKamar(): Promise<HalamanTambahKamar> {
  await connection();
  const session = await getWorkspaceSession();
  const kamar = await getDaftarKamarPenghuni(await getDb(), session.organization.id);

  const tipeAda = new Map<string, RencanaTipe>();
  for (const k of kamar) {
    if (tipeAda.has(k.tipe)) continue;
    const kode = /^[A-Za-z]+/.exec(k.nomorKamar)?.[0] ?? "";
    tipeAda.set(k.tipe, { tipe: k.tipe, kode, jumlah: 1, hargaSewa: k.hargaSewa });
  }

  return {
    namaKos: session.organization.namaKos,
    alamatKos: session.organization.alamat,
    nomorKamarAda: kamar.map((k) => k.nomorKamar),
    tipeAda: [...tipeAda.values()],
  };
}
