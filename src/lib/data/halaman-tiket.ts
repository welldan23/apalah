// Kontrak data halaman tiket keluhan penyewa.
// - Penyewa (/invoice/[token]/tiket/status): lewat tautan invoice tanpa login, hanya tiket miliknya.
// - Owner/admin (/tiket): semua tiket kos yang sedang dibuka.

import { getDb } from "@/db";
import { getWorkspaceSession } from "@/lib/data/session";
import { getTiketKos, getTiketPenyewa, type TiketPenyewaHalaman } from "@/lib/data/tiket";
import type { TiketKos } from "@/lib/tiket";

export type HalamanStatusTiket = TiketPenyewaHalaman;

/** null bila token tidak dikenal. */
export async function getHalamanStatusTiket(token: string): Promise<HalamanStatusTiket | null> {
  return getTiketPenyewa(await getDb(), token);
}

export type HalamanTiketOwner = { namaKos: string; tiket: TiketKos[] };

export async function getHalamanTiketOwner(): Promise<HalamanTiketOwner> {
  const session = await getWorkspaceSession();
  return {
    namaKos: session.organization.namaKos,
    tiket: await getTiketKos(await getDb(), session.organization.id),
  };
}
