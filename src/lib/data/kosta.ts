// Kontrak data halaman Chat Kosta.
// Tahap frontend: riwayat percakapan dari data tiruan. Tahap backend: ambil dari wa_messages
// percakapan owner yang sedang masuk — bentuk `HalamanKosta` tetap sama.

import { connection } from "next/server";

import { getWorkspaceSession } from "@/lib/data/session";
import { mockPercakapanKosta, mockWorkspaceLain } from "@/lib/mock/kosta";
import type { PesanKosta, WorkspaceRingkas } from "@/lib/types";
import { hariIniWib } from "@/lib/waktu";

export type HalamanKosta = {
  hariIni: string;
  /** Kos yang sedang dibahas Kosta. */
  workspaceAktif: string;
  /** Semua kos yang bisa dikelola owner; lebih dari satu = perlu pemilih workspace. */
  workspaces: WorkspaceRingkas[];
  /** Nomor WhatsApp owner yang tertaut ke Kosta. */
  nomorWa: string;
  pesan: PesanKosta[];
};

export async function getHalamanKosta(): Promise<HalamanKosta> {
  await connection();
  const session = await getWorkspaceSession();
  const { organization } = session;
  return {
    hariIni: hariIniWib(),
    workspaceAktif: organization.id,
    workspaces: [
      {
        id: organization.id,
        namaKos: organization.namaKos,
        jumlahKamar: organization.jumlahKamar,
        peran: session.peran,
      },
      ...mockWorkspaceLain,
    ],
    nomorWa: session.user.nomorWa,
    pesan: mockPercakapanKosta,
  };
}
