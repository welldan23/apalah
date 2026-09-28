// Otomatisasi workspace saat daftar: dari data kos pertama, dalam satu transaksi —
// nama pemilik diperbarui, organisasi (kos) dibuat, pengguna jadi owner, jadwal pengingat bawaan
// dipasang, dan sesi login langsung membuka kos baru itu. Nomor WA sudah tertaut sejak OTP.

import { and, eq, inArray } from "drizzle-orm";

import { schema, type Db } from "../../db/index.ts";
import { periksaDataKos, type DataKosPertama } from "../daftar-kos.ts";
import { GalatAksi } from "./galat.ts";
import { sisipkanJadwalBawaan } from "./jadwal-pengingat.ts";

const { members, organizations, sessions, users } = schema;

const teks = (nilai: unknown) => (typeof nilai === "string" ? nilai.trim() : "");

/** Body: { namaPemilik, namaKos, jumlahKamar } — aturan sama dengan form. */
export function bacaInputWorkspace(body: Record<string, unknown>): DataKosPertama {
  const data = {
    namaPemilik: teks(body.namaPemilik),
    namaKos: teks(body.namaKos),
    jumlahKamar: typeof body.jumlahKamar === "number" ? body.jumlahKamar : Number.NaN,
  };
  const [galat] = Object.values(periksaDataKos(data));
  if (galat) throw new GalatAksi(galat);
  return data;
}

export async function buatWorkspacePertama(
  db: Db,
  { userId, sessionId }: { userId: string; sessionId: string },
  input: DataKosPertama,
): Promise<{ organizationId: string; namaKos: string }> {
  return db.transaction(async (tx) => {
    // Kunci baris pengguna: kirim ganda tidak membuat dua kos.
    const [pengguna] = await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update");
    if (!pengguna) throw new GalatAksi("Akun tidak ditemukan.", 404);
    const [ada] = await tx
      .select({ id: members.id })
      .from(members)
      .where(and(eq(members.userId, userId), inArray(members.peran, ["owner", "admin"])))
      .limit(1);
    if (ada) throw new GalatAksi("Akun ini sudah mengelola kos. Buka lewat halaman Pilih kos.", 409);

    await tx.update(users).set({ nama: input.namaPemilik, diperbaruiPada: new Date() }).where(eq(users.id, userId));
    const [kos] = await tx
      .insert(organizations)
      .values({ namaKos: input.namaKos, jumlahKamar: input.jumlahKamar, ownerId: userId })
      .returning({ id: organizations.id });
    await tx.insert(members).values({ organizationId: kos.id, userId, peran: "owner" });
    await sisipkanJadwalBawaan(tx, kos.id);
    await tx
      .update(sessions)
      .set({ organizationId: kos.id })
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)));
    return { organizationId: kos.id, namaKos: input.namaKos };
  });
}
