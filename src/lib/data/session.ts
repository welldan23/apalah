// Workspace aktif untuk pengguna yang sedang masuk: sesi Better Auth (cookie) + keanggotaan aktif di
// kos (lihat src/lib/auth/workspace.ts). Dibaca sekali per permintaan.

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getDb } from "@/db";
import { GalatAksi } from "@/lib/aksi/galat";
import { getSesiLogin } from "@/lib/auth/server";
import { tentukanWorkspace, type HasilWorkspace, type WorkspaceSession } from "@/lib/auth/workspace";

export type { WorkspaceSession };

/** Sesi login (tanpa syarat kos aktif); null bila belum masuk. */
export const getSesiPengguna = cache(async () => getSesiLogin(await headers()));

const bacaWorkspace = cache(async (): Promise<HasilWorkspace> => {
  const sesi = await getSesiPengguna();
  if (!sesi) return { status: "tanpa_sesi" };
  return tentukanWorkspace(await getDb(), {
    userId: sesi.user.id,
    sessionId: sesi.session.id,
    organizationId: sesi.session.organizationId ?? null,
  });
});

const TUJUAN: Record<Exclude<HasilWorkspace["status"], "siap">, string> = {
  tanpa_sesi: "/masuk",
  tanpa_kos: "/daftar/workspace",
  pilih_kos: "/pilih-kos",
};

/** Untuk halaman & layout: belum masuk → /masuk, belum punya kos → /daftar/workspace, perlu memilih → /pilih-kos. */
export async function getWorkspaceSession(): Promise<WorkspaceSession> {
  const hasil = await bacaWorkspace();
  if (hasil.status === "siap") return hasil.sesi;
  redirect(TUJUAN[hasil.status]);
}

/** Untuk route handler: galat JSON 401 (belum masuk) / 409 (belum memilih kos). */
export async function getWorkspaceSessionApi(): Promise<WorkspaceSession> {
  const hasil = await bacaWorkspace();
  if (hasil.status === "siap") return hasil.sesi;
  if (hasil.status === "tanpa_sesi") throw new GalatAksi("Sesi berakhir. Masuk lagi dengan nomor WhatsApp.", 401);
  throw new GalatAksi("Pilih kos yang mau dikelola dulu.", 409);
}
