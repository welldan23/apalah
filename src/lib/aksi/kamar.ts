// Kelola kamar: tambah massal dari rencana wizard (ke kos ini atau kos baru), ubah data kamar,
// serta nonaktifkan/aktifkan lagi. Kamar tidak pernah dihapus karena riwayat tagihannya harus tetap ada.

import { and, count, eq } from "drizzle-orm";

import { schema, type Db } from "../../db/index.ts";
import { buatDaftarKamar, MAKS_KAMAR_PER_TIPE, periksaRencana, type RencanaTipe } from "../rencana-kamar.ts";
import { GalatAksi, nominalValid } from "./galat.ts";

const { members, organizations, rooms } = schema;

const MAKS_BARIS = 20;
const MAKS_KAMAR = 500;

export type InputTambahKamar = {
  rencana: RencanaTipe[];
  /** Diisi bila kamar ditambahkan ke kos baru (sekaligus membuat kos). */
  kosBaru?: { namaKos: string; alamat: string };
};

const teks = (nilai: unknown) => (typeof nilai === "string" ? nilai.trim() : "");

export function bacaInputTambahKamar(body: Record<string, unknown>): InputTambahKamar {
  const { rencana, kosBaru } = body;
  if (!Array.isArray(rencana) || rencana.length === 0 || rencana.length > MAKS_BARIS) {
    throw new GalatAksi(`Isi 1–${MAKS_BARIS} baris tipe kamar.`);
  }
  const baris: RencanaTipe[] = rencana.map((r: Record<string, unknown> | null) => ({
    tipe: teks(r?.tipe).slice(0, 40),
    kode: teks(r?.kode),
    jumlah: Number(r?.jumlah),
    hargaSewa: Number(r?.hargaSewa),
  }));
  const galat = periksaRencana(baris).find(Boolean);
  if (galat) throw new GalatAksi(galat);
  if (baris.reduce((total, r) => total + r.jumlah, 0) > MAKS_KAMAR) {
    throw new GalatAksi(`Maksimal ${MAKS_KAMAR} kamar sekali tambah (${MAKS_KAMAR_PER_TIPE} per tipe).`);
  }

  if (kosBaru == null) return { rencana: baris };
  const k = kosBaru as Record<string, unknown>;
  const namaKos = teks(k.namaKos);
  if (namaKos.length < 2 || namaKos.length > 80) throw new GalatAksi("Nama kos 2–80 karakter.");
  return { rencana: baris, kosBaru: { namaKos, alamat: teks(k.alamat).slice(0, 200) } };
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** organizations.jumlah_kamar = jumlah kamar aktif. */
async function sinkronJumlahKamar(tx: Tx, organizationId: string) {
  const [{ n }] = await tx
    .select({ n: count() })
    .from(rooms)
    .where(and(eq(rooms.organizationId, organizationId), eq(rooms.aktif, true)));
  await tx.update(organizations).set({ jumlahKamar: n }).where(eq(organizations.id, organizationId));
}

export async function tambahKamar(
  db: Db,
  { organizationId, userId }: { organizationId: string; userId: string },
  input: InputTambahKamar,
) {
  return db.transaction(async (tx) => {
    let tujuan = organizationId;
    if (input.kosBaru) {
      const [kos] = await tx
        .insert(organizations)
        .values({ namaKos: input.kosBaru.namaKos, alamat: input.kosBaru.alamat, jumlahKamar: 0, ownerId: userId })
        .returning({ id: organizations.id });
      await tx.insert(members).values({ organizationId: kos.id, userId, peran: "owner" });
      tujuan = kos.id;
    }

    // Nomor dihitung ulang di server dari SEMUA kamar (termasuk nonaktif) supaya tidak bentrok.
    const ada = await tx.select({ nomorKamar: rooms.nomorKamar }).from(rooms).where(eq(rooms.organizationId, tujuan));
    const daftar = buatDaftarKamar(
      input.rencana,
      ada.map((k) => k.nomorKamar),
    );
    await tx.insert(rooms).values(daftar.map((k) => ({ ...k, organizationId: tujuan, status: "kosong" as const })));
    await sinkronJumlahKamar(tx, tujuan);

    const [kos] = await tx.select({ namaKos: organizations.namaKos }).from(organizations).where(eq(organizations.id, tujuan));
    return { organizationId: tujuan, namaKos: kos.namaKos, nomorKamar: daftar.map((k) => k.nomorKamar) };
  });
}

export type PerubahanKamar = { tipe?: string; hargaSewa?: number; catatan?: string | null; aktif?: boolean };

export function bacaPerubahanKamar(body: Record<string, unknown>): PerubahanKamar {
  const hasil: PerubahanKamar = {};
  if (body.tipe !== undefined) {
    const tipe = teks(body.tipe);
    if (!tipe || tipe.length > 40) throw new GalatAksi("Tipe kamar 1–40 karakter.");
    hasil.tipe = tipe;
  }
  if (body.hargaSewa !== undefined) {
    if (!nominalValid(body.hargaSewa)) throw new GalatAksi("Harga sewa harus bilangan bulat rupiah lebih dari 0.");
    hasil.hargaSewa = body.hargaSewa;
  }
  if (body.catatan !== undefined) {
    const catatan = teks(body.catatan);
    if (catatan.length > 200) throw new GalatAksi("Catatan maksimal 200 karakter.");
    hasil.catatan = catatan || null;
  }
  if (body.aktif !== undefined) {
    if (typeof body.aktif !== "boolean") throw new GalatAksi("aktif harus true atau false.");
    hasil.aktif = body.aktif;
  }
  if (Object.keys(hasil).length === 0) throw new GalatAksi("Tidak ada perubahan.");
  return hasil;
}

/** Ubah data kamar; menonaktifkan hanya boleh untuk kamar kosong (harga sewa penghuni tidak berubah). */
export async function ubahKamar(db: Db, organizationId: string, roomId: string, perubahan: PerubahanKamar) {
  return db.transaction(async (tx) => {
    const [kamar] = await tx
      .select({ nomorKamar: rooms.nomorKamar, status: rooms.status })
      .from(rooms)
      .where(and(eq(rooms.id, roomId), eq(rooms.organizationId, organizationId)))
      .for("update");
    if (!kamar) throw new GalatAksi("Kamar tidak ditemukan.", 404);
    if (perubahan.aktif === false && kamar.status === "terisi") {
      throw new GalatAksi(`Kamar ${kamar.nomorKamar} masih terisi. Pindahkan atau keluarkan penghuninya dulu.`, 409);
    }

    const [hasil] = await tx
      .update(rooms)
      .set(perubahan)
      .where(eq(rooms.id, roomId))
      .returning({
        id: rooms.id,
        nomorKamar: rooms.nomorKamar,
        tipe: rooms.tipe,
        hargaSewa: rooms.hargaSewa,
        catatan: rooms.catatan,
        status: rooms.status,
        aktif: rooms.aktif,
      });
    if (perubahan.aktif !== undefined) await sinkronJumlahKamar(tx, organizationId);
    return hasil;
  });
}
