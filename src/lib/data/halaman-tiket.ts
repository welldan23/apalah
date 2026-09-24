// Kontrak data tiket keluhan penyewa.
// - Penyewa (/invoice/[token]/tiket/status): lewat tautan invoice tanpa login, hanya tiket kamarnya.
// - Owner/admin (/tiket, dashboard): semua tiket kos yang sedang dibuka.
// Tahap frontend: tiket dari data contoh; tahap backend: tabel tickets.

import { getDb } from "@/db";
import { getInvoicePublik } from "@/lib/data/invoice-publik";
import { getWorkspaceSession } from "@/lib/data/session";
import { mockTiketKos, mockTiketPerKamar } from "@/lib/mock/tiket";
import { hitungTiket, urutkanTiket, type StatusTiket, type TiketKos, type TiketPenyewa } from "@/lib/tiket";

export type HalamanStatusTiket = {
  namaKos: string;
  namaPenghuni: string;
  nomorKamar: string;
  tiket: TiketPenyewa[];
};

/** null bila token tidak dikenal. */
export async function getHalamanStatusTiket(token: string): Promise<HalamanStatusTiket | null> {
  const inv = await getInvoicePublik(await getDb(), token);
  if (!inv) return null;
  return {
    namaKos: inv.namaKos,
    namaPenghuni: inv.namaPenghuni,
    nomorKamar: inv.nomorKamar,
    tiket: urutkanTiket(mockTiketPerKamar[inv.nomorKamar] ?? []),
  };
}

export type HalamanTiketOwner = { namaKos: string; tiket: TiketKos[] };

export async function getHalamanTiketOwner(): Promise<HalamanTiketOwner> {
  const session = await getWorkspaceSession();
  return {
    namaKos: session.organization.namaKos,
    tiket: urutkanTiket(mockTiketKos[session.organization.id] ?? []),
  };
}

/** Jumlah tiket per status satu kos — untuk banner dashboard. */
export function getRingkasanTiket(organizationId: string): Record<StatusTiket, number> {
  return hitungTiket(mockTiketKos[organizationId] ?? []);
}
