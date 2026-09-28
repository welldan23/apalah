// Kelola platform admin (operator Kostera) — sengaja hanya lewat skrip server, tidak ada jalur dari UI.
// Pakai:
//   npm run platform:admin -- daftar
//   npm run platform:admin -- tambah 6281234567890
//   npm run platform:admin -- hapus 6281234567890
// Nomor harus milik akun Kostera yang sudah terverifikasi OTP. Setiap perubahan tercatat di log admin.

import { pathToFileURL } from "node:url";

import { and, eq } from "drizzle-orm";

import { normalisasiNomorWa } from "../lib/nomor-wa.ts";
import { catatLogPlatform } from "../lib/platform/akses.ts";
import { getDb, tutupDb, schema, type Db } from "./index.ts";

export async function kelolaPlatformAdmin(db: Db, perintah: string, nomor?: string): Promise<string> {
  if (perintah === "daftar") {
    const daftar = await db
      .select({ nama: schema.users.nama, nomorWa: schema.users.nomorWa })
      .from(schema.platformAdmins)
      .innerJoin(schema.users, eq(schema.users.id, schema.platformAdmins.userId));
    return daftar.length ? daftar.map((a) => `${a.nama} (${a.nomorWa})`).join("\n") : "Belum ada platform admin.";
  }
  if (perintah !== "tambah" && perintah !== "hapus") throw new Error("Perintah: daftar | tambah <nomor> | hapus <nomor>");
  const nomorWa = normalisasiNomorWa(nomor ?? "");
  if (!nomorWa) throw new Error("Nomor WhatsApp tidak valid.");
  const [pengguna] = await db
    .select({ id: schema.users.id, nama: schema.users.nama })
    .from(schema.users)
    .where(and(eq(schema.users.nomorWa, nomorWa), eq(schema.users.nomorWaTerverifikasi, true)));
  if (!pengguna) throw new Error("Nomor belum terdaftar/terverifikasi di Kostera. Masuk sekali lewat OTP dulu.");

  if (perintah === "tambah") {
    await db.insert(schema.platformAdmins).values({ userId: pengguna.id }).onConflictDoNothing();
  } else {
    await db.delete(schema.platformAdmins).where(eq(schema.platformAdmins.userId, pengguna.id));
  }
  await catatLogPlatform(db, { adminUserId: null, aksi: perintah === "tambah" ? "tambah_admin" : "hapus_admin", detail: { userId: pengguna.id } });
  return `${pengguna.nama} ${perintah === "tambah" ? "sekarang platform admin" : "bukan lagi platform admin"}.`;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [perintah = "daftar", nomor] = process.argv.slice(2);
  try {
    console.log(await kelolaPlatformAdmin(await getDb(), perintah, nomor));
  } catch (err) {
    console.error((err as Error).message);
    process.exitCode = 1;
  } finally {
    await tutupDb();
  }
}
