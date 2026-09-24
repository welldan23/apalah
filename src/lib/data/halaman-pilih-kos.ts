// Kontrak data halaman Pilih kos: semua kos (workspace) yang boleh dikelola pengguna yang sedang masuk.

import { redirect } from "next/navigation";

import { getDb } from "@/db";
import { getSesiPengguna } from "@/lib/data/session";
import { daftarWorkspace } from "@/lib/kosta/workspace";
import type { WorkspaceRingkas } from "@/lib/types";

export type HalamanPilihKos = {
  namaPengguna: string;
  /** Kos yang sedang dibuka di sesi ini, bila ada. */
  aktifId: string | null;
  workspaces: WorkspaceRingkas[];
};

export async function getHalamanPilihKos(): Promise<HalamanPilihKos> {
  const sesi = await getSesiPengguna();
  if (!sesi) redirect("/masuk");
  const workspaces = await daftarWorkspace(await getDb(), sesi.user.id);
  if (workspaces.length === 0) redirect("/daftar/workspace");
  return { namaPengguna: sesi.user.name, aktifId: sesi.session.organizationId ?? null, workspaces };
}
