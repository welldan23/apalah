// Kontrak data halaman Chat Kosta. Daftar kos dari keanggotaan owner/admin di database;
// riwayat percakapan masih data tiruan sampai dibaca dari wa_messages — bentuk `HalamanKosta` tetap.

import { connection } from "next/server";

import { getDb } from "@/db";
import { getWorkspaceSession } from "@/lib/data/session";
import { daftarWorkspace } from "@/lib/kosta/workspace";
import { mockPercakapanKosta } from "@/lib/mock/kosta";
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
    workspaces: await daftarWorkspace(await getDb(), session.user.id),
    nomorWa: session.user.nomorWa,
    pesan: mockPercakapanKosta,
  };
}
