// Mencocokkan nomor WhatsApp pengirim ke pengguna & kos (workspace) yang boleh ia kelola lewat Kosta.
// Aturan akses (deterministik, bukan dari AI):
// - hanya nomor yang terverifikasi (OTP) milik pengguna terdaftar;
// - hanya kos tempat ia owner/admin dengan keanggotaan aktif — penyewa tidak memakai Kosta;
// - satu kos → langsung dipakai; lebih dari satu → owner memilih dulu.

import { and, asc, eq, inArray } from "drizzle-orm";

import { schema, type Db } from "../../db/index.ts";
import type { WorkspaceRingkas } from "@/lib/types";

const { members, organizations, users, waConversations } = schema;

export type KonteksPengirim =
  /** Nomor belum terdaftar/terverifikasi — tidak boleh membaca data kos apa pun. */
  | { status: "tidak_dikenal" }
  /** Terdaftar, tapi bukan owner/admin aktif di kos mana pun. */
  | { status: "tanpa_akses"; userId: string }
  | { status: "pilih_workspace"; userId: string; workspaces: WorkspaceRingkas[] }
  | { status: "siap"; userId: string; workspace: WorkspaceRingkas; workspaces: WorkspaceRingkas[] };

/** Kos yang bisa dikelola pengguna lewat Kosta (owner/admin, keanggotaan aktif), urut nama. */
export async function daftarWorkspace(db: Db, userId: string): Promise<WorkspaceRingkas[]> {
  return db
    .select({
      id: organizations.id,
      namaKos: organizations.namaKos,
      jumlahKamar: organizations.jumlahKamar,
      peran: members.peran,
    })
    .from(members)
    .innerJoin(organizations, eq(organizations.id, members.organizationId))
    .where(and(eq(members.userId, userId), eq(members.status, "aktif"), inArray(members.peran, ["owner", "admin"])))
    .orderBy(asc(organizations.namaKos));
}

async function simpanTautan(db: Db, conversationId: string, userId: string | null, organizationId: string | null) {
  await db.update(waConversations).set({ userId, organizationId }).where(eq(waConversations.id, conversationId));
}

/**
 * Cocokkan pengirim sebuah percakapan dan perbarui tautannya (pengguna + kos aktif).
 * Kos aktif sebelumnya dipertahankan selama masih boleh diakses.
 */
export async function cocokkanNomorWa(db: Db, conversationId: string): Promise<KonteksPengirim> {
  const [percakapan] = await db
    .select({ nomorWa: waConversations.nomorWa, organizationId: waConversations.organizationId })
    .from(waConversations)
    .where(eq(waConversations.id, conversationId));
  if (!percakapan) return { status: "tidak_dikenal" };

  const [pengguna] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.nomorWa, percakapan.nomorWa), eq(users.nomorWaTerverifikasi, true)));
  if (!pengguna) {
    await simpanTautan(db, conversationId, null, null);
    return { status: "tidak_dikenal" };
  }

  const workspaces = await daftarWorkspace(db, pengguna.id);
  const aktif =
    workspaces.find((w) => w.id === percakapan.organizationId) ??
    (workspaces.length === 1 ? workspaces[0] : undefined);
  await simpanTautan(db, conversationId, pengguna.id, aktif?.id ?? null);

  if (workspaces.length === 0) return { status: "tanpa_akses", userId: pengguna.id };
  if (!aktif) return { status: "pilih_workspace", userId: pengguna.id, workspaces };
  return { status: "siap", userId: pengguna.id, workspace: aktif, workspaces };
}

/** Ganti kos aktif percakapan; null bila pengirim tidak berhak atas kos tersebut. */
export async function pilihWorkspace(db: Db, conversationId: string, organizationId: string) {
  const konteks = await cocokkanNomorWa(db, conversationId);
  if (konteks.status !== "siap" && konteks.status !== "pilih_workspace") return null;
  const workspace = konteks.workspaces.find((w) => w.id === organizationId);
  if (!workspace) return null;
  await simpanTautan(db, conversationId, konteks.userId, workspace.id);
  return { ...konteks, status: "siap" as const, workspace };
}

/** Jawaban owner atas daftar kos: nomor urut ("2") atau nama kos ("mawar"). */
export function cariPilihanWorkspace(teks: string, workspaces: WorkspaceRingkas[]) {
  const jawaban = teks.trim().toLowerCase();
  if (/^\d+$/.test(jawaban)) return workspaces[Number(jawaban) - 1] ?? null;
  if (jawaban.length < 3) return null;
  const cocok = workspaces.filter((w) => w.namaKos.toLowerCase().includes(jawaban));
  return cocok.length === 1 ? cocok[0] : null;
}
