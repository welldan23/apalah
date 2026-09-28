// Jadwal pengingat bayar otomatis per kos (tabel reminder_schedules + saklar utama
// organizations.pengingat_otomatis): baca, validasi, simpan satu set lengkap.

import { and, asc, eq, notInArray } from "drizzle-orm";

import { schema, type Db } from "../../db/index.ts";
import { JADWAL_BAWAAN, MAKS_JADWAL, periksaJadwal, type JadwalPengingat } from "../reminder.ts";
import { GalatAksi } from "./galat.ts";

const { organizations, reminderSchedules } = schema;

export type PengaturanPengingat = {
  /** Saklar utama; bila mati, tidak ada pengingat otomatis walau jadwalnya aktif. */
  otomatisAktif: boolean;
  /** Urut offset hari (H-3 → H → H+3). */
  jadwal: JadwalPengingat[];
};

/** Kos baru langsung punya jadwal bawaan H-3 / H / H+3 jam 09.00 WIB. */
export async function sisipkanJadwalBawaan(db: Pick<Db, "insert">, organizationId: string) {
  await db.insert(reminderSchedules).values(
    JADWAL_BAWAAN.map((j) => ({ organizationId, offsetHari: j.offsetHari, jamKirim: j.jam, aktif: j.aktif })),
  );
}

export async function getPengaturanPengingat(db: Db, organizationId: string): Promise<PengaturanPengingat> {
  const [kos] = await db
    .select({ otomatisAktif: organizations.pengingatOtomatis })
    .from(organizations)
    .where(eq(organizations.id, organizationId));
  if (!kos) throw new GalatAksi("Kos tidak ditemukan.", 404);
  const jadwal = await db
    .select({ offsetHari: reminderSchedules.offsetHari, jamKirim: reminderSchedules.jamKirim, aktif: reminderSchedules.aktif })
    .from(reminderSchedules)
    .where(eq(reminderSchedules.organizationId, organizationId))
    .orderBy(asc(reminderSchedules.offsetHari));
  return {
    otomatisAktif: kos.otomatisAktif,
    // Kolom time dibaca "09:00:00" → "09:00".
    jadwal: jadwal.map((j) => ({ offsetHari: j.offsetHari, jam: j.jamKirim.slice(0, 5), aktif: j.aktif })),
  };
}

/** Body PUT: { otomatisAktif: boolean, jadwal: [{ offsetHari, jam: "HH:MM", aktif }] } — aturan sama dengan form. */
export function bacaInputPengaturanPengingat(body: Record<string, unknown>): PengaturanPengingat {
  const { otomatisAktif, jadwal } = body;
  if (typeof otomatisAktif !== "boolean") throw new GalatAksi("otomatisAktif harus true atau false.");
  if (!Array.isArray(jadwal) || jadwal.length > MAKS_JADWAL) throw new GalatAksi(`Isi 0–${MAKS_JADWAL} jadwal.`);

  const daftar: JadwalPengingat[] = [];
  for (const j of jadwal as (Record<string, unknown> | null)[]) {
    const { offsetHari, jam, aktif } = j ?? {};
    if (typeof offsetHari !== "number" || typeof jam !== "string" || typeof aktif !== "boolean") {
      throw new GalatAksi("Tiap jadwal butuh offsetHari (angka), jam (\"HH:MM\"), dan aktif (true/false).");
    }
    const item = { offsetHari, jam, aktif };
    const galat = periksaJadwal(item, daftar);
    if (galat) throw new GalatAksi(galat);
    daftar.push(item);
  }
  return { otomatisAktif, jadwal: daftar.sort((a, b) => a.offsetHari - b.offsetHari) };
}

/** Simpan saklar utama + ganti seluruh jadwal kos dengan `p.jadwal` (tambah, ubah, hapus) dalam satu transaksi. */
export async function simpanPengaturanPengingat(
  db: Db,
  organizationId: string,
  p: PengaturanPengingat,
): Promise<PengaturanPengingat> {
  await db.transaction(async (tx) => {
    // Kunci baris kos supaya dua penyimpanan bersamaan tidak saling bercampur.
    const [kos] = await tx
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .for("update");
    if (!kos) throw new GalatAksi("Kos tidak ditemukan.", 404);

    await tx.update(organizations).set({ pengingatOtomatis: p.otomatisAktif }).where(eq(organizations.id, organizationId));
    const offset = p.jadwal.map((j) => j.offsetHari);
    await tx
      .delete(reminderSchedules)
      .where(
        and(
          eq(reminderSchedules.organizationId, organizationId),
          offset.length ? notInArray(reminderSchedules.offsetHari, offset) : undefined,
        ),
      );
    for (const j of p.jadwal) {
      await tx
        .insert(reminderSchedules)
        .values({ organizationId, offsetHari: j.offsetHari, jamKirim: j.jam, aktif: j.aktif })
        .onConflictDoUpdate({
          target: [reminderSchedules.organizationId, reminderSchedules.offsetHari],
          set: { jamKirim: j.jam, aktif: j.aktif },
        });
    }
  });
  return getPengaturanPengingat(db, organizationId);
}
