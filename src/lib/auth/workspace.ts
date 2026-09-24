// Workspace (kos) aktif untuk sesi login — aturan akses organisasi yang dipakai semua halaman & API:
// - hanya kos tempat pengguna punya keanggotaan AKTIF (peran dari keanggotaan itu);
// - kos aktif di sesi dipakai selama masih boleh diakses; bila kosong/tidak berlaku dan pengguna hanya
//   punya satu kos, kos itu dipilih otomatis (dan disimpan di sesi); lebih dari satu → pilih dulu.

import { and, asc, eq } from "drizzle-orm";

import { schema, type Db } from "../../db/index.ts";
import { GalatAksi } from "../aksi/galat.ts";
import type { Organization, Owner } from "@/lib/types";

const { members, organizations, sessions, users } = schema;

export type WorkspaceSession = {
  organization: Organization;
  user: Owner;
  peran: "owner" | "admin" | "penyewa";
};

export type HasilWorkspace =
  | { status: "siap"; sesi: WorkspaceSession }
  /** Belum masuk atau sesi tidak berlaku. */
  | { status: "tanpa_sesi" }
  /** Masuk, tapi belum mengelola kos mana pun. */
  | { status: "tanpa_kos" }
  /** Mengelola beberapa kos dan belum memilih. */
  | { status: "pilih_kos" };

type SesiLogin = { userId: string; sessionId: string; organizationId: string | null };

async function keanggotaanAktif(db: Db, userId: string) {
  return db
    .select({
      id: organizations.id,
      namaKos: organizations.namaKos,
      alamat: organizations.alamat,
      jumlahKamar: organizations.jumlahKamar,
      peran: members.peran,
    })
    .from(members)
    .innerJoin(organizations, eq(organizations.id, members.organizationId))
    .where(and(eq(members.userId, userId), eq(members.status, "aktif")))
    .orderBy(asc(organizations.namaKos));
}

export async function tentukanWorkspace(db: Db, sesi: SesiLogin): Promise<HasilWorkspace> {
  const [pengguna] = await db
    .select({ id: users.id, nama: users.nama, nomorWa: users.nomorWa })
    .from(users)
    .where(eq(users.id, sesi.userId));
  if (!pengguna) return { status: "tanpa_sesi" };

  const anggota = await keanggotaanAktif(db, sesi.userId);
  const pilihan = anggota.find((a) => a.id === sesi.organizationId) ?? (anggota.length === 1 ? anggota[0] : undefined);
  if (!pilihan) return { status: anggota.length ? "pilih_kos" : "tanpa_kos" };

  if (pilihan.id !== sesi.organizationId) {
    await db.update(sessions).set({ organizationId: pilihan.id }).where(eq(sessions.id, sesi.sessionId));
  }
  const { peran, ...organization } = pilihan;
  return { status: "siap", sesi: { organization, user: pengguna, peran } };
}

/** Ganti kos aktif sesi; hanya kos tempat pengguna punya keanggotaan aktif (selain itu 403). */
export async function pilihWorkspaceAktif(
  db: Db,
  { userId, sessionId }: { userId: string; sessionId: string },
  organizationId: string,
): Promise<Organization> {
  const pilihan = (await keanggotaanAktif(db, userId)).find((a) => a.id === organizationId);
  if (!pilihan) throw new GalatAksi("Kamu tidak punya akses ke kos ini.", 403);
  await db.update(sessions).set({ organizationId }).where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)));
  return { id: pilihan.id, namaKos: pilihan.namaKos, alamat: pilihan.alamat, jumlahKamar: pilihan.jumlahKamar };
}
