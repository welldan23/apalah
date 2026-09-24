// Kontrak data halaman Chat Kosta.
// Tahap frontend: riwayat percakapan dari data tiruan. Tahap backend: ambil dari wa_messages
// percakapan owner yang sedang masuk — bentuk `HalamanKosta` tetap sama.

import { connection } from "next/server";

import { getWorkspaceSession } from "@/lib/data/session";
import { mockPercakapanKosta } from "@/lib/mock/kosta";
import type { PesanKosta } from "@/lib/types";
import { hariIniWib } from "@/lib/waktu";

export type HalamanKosta = {
  hariIni: string;
  namaKos: string;
  /** Nomor WhatsApp owner yang tertaut ke Kosta. */
  nomorWa: string;
  pesan: PesanKosta[];
};

export async function getHalamanKosta(): Promise<HalamanKosta> {
  await connection();
  const session = await getWorkspaceSession();
  return {
    hariIni: hariIniWib(),
    namaKos: session.organization.namaKos,
    nomorWa: session.user.nomorWa,
    pesan: mockPercakapanKosta,
  };
}
