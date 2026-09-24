// Kontrak data halaman Chat Kosta: daftar kos dari keanggotaan owner/admin dan riwayat percakapan
// dari wa_messages (status preview mengikuti action_drafts) — semuanya dari database.

import { connection } from "next/server";

import { getDb } from "@/db";
import { getWorkspaceSession } from "@/lib/data/session";
import { daftarWorkspace } from "@/lib/kosta/workspace";
import { getPercakapanPengguna } from "@/lib/kosta/riwayat";
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
  const db = await getDb();
  const percakapan = await getPercakapanPengguna(db, session.user.nomorWa);
  return {
    hariIni: hariIniWib(),
    // Kos yang sedang dibahas di percakapan (sama dengan di WhatsApp), atau kos sesi.
    workspaceAktif: percakapan.organizationId ?? session.organization.id,
    workspaces: await daftarWorkspace(db, session.user.id),
    nomorWa: session.user.nomorWa,
    pesan: percakapan.pesan,
  };
}
