// Kontrak data halaman Pilih kos: semua kos (workspace) yang boleh dikelola pengguna yang sedang masuk.
// Tahap frontend: kos aktif masih dari sesi contoh (Kos Melati).

import { connection } from "next/server";

import { getDb } from "@/db";
import { getWorkspaceSession } from "@/lib/data/session";
import { daftarWorkspace } from "@/lib/kosta/workspace";
import type { WorkspaceRingkas } from "@/lib/types";

export type HalamanPilihKos = {
  namaPengguna: string;
  /** Kos yang sedang dibuka. */
  aktifId: string;
  workspaces: WorkspaceRingkas[];
};

export async function getHalamanPilihKos(): Promise<HalamanPilihKos> {
  await connection();
  const session = await getWorkspaceSession();
  return {
    namaPengguna: session.user.nama,
    aktifId: session.organization.id,
    workspaces: await daftarWorkspace(await getDb(), session.user.id),
  };
}
