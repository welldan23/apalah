// Akses konsol platform (platform_admin) — terpisah dari peran owner/admin kos.
// Syarat: sesi login Kostera (OTP WhatsApp) milik pengguna yang terdaftar di platform_admins, dan sesi
// itu masih segar (≤ 12 jam sejak masuk) — sesi lama harus masuk ulang dengan OTP baru.

import { eq } from "drizzle-orm";

import { schema, type Db } from "../../db/index.ts";

export const MAKS_UMUR_SESI_PLATFORM_JAM = 12;

export type AksesPlatform = { status: "bukan_admin" } | { status: "sesi_lama" } | { status: "admin"; userId: string };

export async function periksaAksesPlatform(
  db: Db,
  { userId, sesiDibuatPada, sekarang = new Date() }: { userId: string; sesiDibuatPada: Date; sekarang?: Date },
): Promise<AksesPlatform> {
  const [admin] = await db
    .select({ userId: schema.platformAdmins.userId })
    .from(schema.platformAdmins)
    .where(eq(schema.platformAdmins.userId, userId));
  if (!admin) return { status: "bukan_admin" };
  if (sekarang.getTime() - sesiDibuatPada.getTime() > MAKS_UMUR_SESI_PLATFORM_JAM * 3_600_000) return { status: "sesi_lama" };
  return { status: "admin", userId };
}

export type AksiPlatform = "lihat_workspace" | "suspend_pilot" | "resume_pilot" | "tambah_admin" | "hapus_admin" | "atur_xendit";

/** Catat akses/perubahan platform admin. Detail tidak boleh berisi data penyewa. */
export async function catatLogPlatform(
  db: Pick<Db, "insert">,
  e: { adminUserId: string | null; aksi: AksiPlatform; organizationId?: string | null; detail?: Record<string, unknown> },
) {
  await db.insert(schema.platformAdminLogs).values({
    adminUserId: e.adminUserId,
    aksi: e.aksi,
    organizationId: e.organizationId ?? null,
    detail: e.detail ?? {},
  });
}
