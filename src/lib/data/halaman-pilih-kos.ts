// Kontrak data halaman Pilih kos: semua kos (workspace) yang bisa dibuka pengguna yang sedang masuk —
// sama dengan GET /api/akun/workspace dan aturan POST /api/akun/workspace-aktif.

import { redirect } from "next/navigation";

import { getDb } from "@/db";
import { daftarKeanggotaanAktif } from "@/lib/auth/workspace";
import { getSesiPengguna } from "@/lib/data/session";
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
  const workspaces = await daftarKeanggotaanAktif(await getDb(), sesi.user.id);
  if (workspaces.length === 0) redirect("/daftar/workspace");
  const aktifId = workspaces.some((w) => w.id === sesi.session.organizationId) ? (sesi.session.organizationId ?? null) : null;
  return { namaPengguna: sesi.user.name, aktifId, workspaces };
}
