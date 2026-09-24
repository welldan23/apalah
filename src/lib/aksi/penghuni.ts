// Aksi penghuni: tambah penghuni baru di kamar kosong (kamar jadi terisi) dan pindah kamar.
// Setiap perubahan hunian dicatat di riwayat_hunian.

import { and, eq, isNull } from "drizzle-orm";

import { schema, type Db } from "../../db/index.ts";
import { normalisasiNomorWa } from "../nomor-wa.ts";
import { GalatAksi, nominalValid, tanggalValid } from "./galat.ts";

const { riwayatHunian, rooms, tenants } = schema;

export type InputTambahPenghuni = {
  nama: string;
  /** Sudah dinormalisasi: 6281234567890. */
  nomorWa: string;
  roomId: string;
  tanggalMasuk: string;
  hargaSewa: number;
};

export function bacaInputTambahPenghuni(body: Record<string, unknown>): InputTambahPenghuni {
  const { nama, nomorWa, roomId, tanggalMasuk, hargaSewa } = body;
  const namaBersih = typeof nama === "string" ? nama.trim() : "";
  if (!namaBersih || namaBersih.length > 100) throw new GalatAksi("Isi nama penghuni (maks. 100 huruf).");
  const nomor = typeof nomorWa === "string" ? normalisasiNomorWa(nomorWa) : null;
  if (!nomor) throw new GalatAksi("Nomor WhatsApp tidak valid, contoh 0812 3456 7890.");
  if (typeof roomId !== "string" || !roomId) throw new GalatAksi("Pilih kamar yang masih kosong.");
  if (!tanggalValid(tanggalMasuk)) throw new GalatAksi("Tanggal masuk tidak valid.");
  if (!nominalValid(hargaSewa)) throw new GalatAksi("Harga sewa harus bilangan bulat rupiah lebih dari 0.");
  return { nama: namaBersih, nomorWa: nomor, roomId, tanggalMasuk, hargaSewa };
}

export async function tambahPenghuni(db: Db, organizationId: string, input: InputTambahPenghuni) {
  return db.transaction(async (tx) => {
    // Kunci kamar: hanya berhasil bila kamar milik kos ini, aktif, dan masih kosong.
    const [kamar] = await tx
      .update(rooms)
      .set({ status: "terisi" })
      .where(
        and(
          eq(rooms.id, input.roomId),
          eq(rooms.organizationId, organizationId),
          eq(rooms.status, "kosong"),
          eq(rooms.aktif, true),
        ),
      )
      .returning({ nomorKamar: rooms.nomorKamar });

    if (!kamar) {
      const [ada] = await tx
        .select({ nomorKamar: rooms.nomorKamar, aktif: rooms.aktif })
        .from(rooms)
        .where(and(eq(rooms.id, input.roomId), eq(rooms.organizationId, organizationId)));
      if (!ada) throw new GalatAksi("Kamar tidak ditemukan.", 404);
      throw new GalatAksi(`Kamar ${ada.nomorKamar} ${ada.aktif ? "sudah terisi" : "sedang nonaktif"}.`, 409);
    }

    const [penghuni] = await tx
      .insert(tenants)
      .values({ organizationId, ...input, status: "aktif" })
      .returning({ id: tenants.id });
    await tx.insert(riwayatHunian).values({
      organizationId,
      tenantId: penghuni.id,
      roomId: input.roomId,
      tanggalMulai: input.tanggalMasuk,
      hargaSewa: input.hargaSewa,
    });
    return { tenantId: penghuni.id, nomorKamar: kamar.nomorKamar };
  });
}

export type InputPindahKamar = {
  dariRoomId: string;
  keRoomId: string;
  /** Tanggal pindah (YYYY-MM-DD). */
  tanggal: string;
  /** "tetap" = sewa penghuni tidak berubah; "ikut_kamar" = mengikuti harga kamar tujuan. */
  sewa: "tetap" | "ikut_kamar";
};

export function bacaInputPindahKamar(body: Record<string, unknown>): InputPindahKamar {
  const { dariRoomId, keRoomId, tanggal, sewa } = body;
  if (typeof dariRoomId !== "string" || !dariRoomId) throw new GalatAksi("Pilih kamar asal.");
  if (typeof keRoomId !== "string" || !keRoomId) throw new GalatAksi("Pilih kamar tujuan.");
  if (dariRoomId === keRoomId) throw new GalatAksi("Kamar tujuan harus berbeda dari kamar asal.");
  if (!tanggalValid(tanggal)) throw new GalatAksi("Tanggal pindah tidak valid.");
  if (sewa !== "tetap" && sewa !== "ikut_kamar") throw new GalatAksi('Pilihan sewa harus "tetap" atau "ikut_kamar".');
  return { dariRoomId, keRoomId, tanggal, sewa };
}

/**
 * Pindahkan penghuni aktif ke kamar kosong dalam satu transaksi: kamar tujuan terisi, kamar asal
 * kosong, sewa tetap/ikut kamar tujuan, riwayat hunian ditutup & dibuka. Tagihan yang sudah terbit
 * tidak diubah.
 */
export async function pindahKamar(db: Db, organizationId: string, input: InputPindahKamar) {
  return db.transaction(async (tx) => {
    const [penghuni] = await tx
      .select({ id: tenants.id, nama: tenants.nama, hargaSewa: tenants.hargaSewa, nomorKamar: rooms.nomorKamar })
      .from(tenants)
      .innerJoin(rooms, eq(rooms.id, tenants.roomId))
      .where(
        and(
          eq(tenants.organizationId, organizationId),
          eq(tenants.roomId, input.dariRoomId),
          eq(tenants.status, "aktif"),
        ),
      )
      .for("update");
    if (!penghuni) throw new GalatAksi("Tidak ada penghuni aktif di kamar asal.", 404);

    const [hunian] = await tx
      .select({ id: riwayatHunian.id, tanggalMulai: riwayatHunian.tanggalMulai })
      .from(riwayatHunian)
      .where(and(eq(riwayatHunian.tenantId, penghuni.id), isNull(riwayatHunian.tanggalSelesai)));
    if (hunian && input.tanggal < hunian.tanggalMulai) {
      throw new GalatAksi("Tanggal pindah tidak boleh sebelum tanggal mulai menghuni kamar asal.");
    }

    // Kunci kamar tujuan: hanya berhasil bila milik kos ini, aktif, dan masih kosong.
    const [tujuan] = await tx
      .update(rooms)
      .set({ status: "terisi" })
      .where(
        and(
          eq(rooms.id, input.keRoomId),
          eq(rooms.organizationId, organizationId),
          eq(rooms.status, "kosong"),
          eq(rooms.aktif, true),
        ),
      )
      .returning({ nomorKamar: rooms.nomorKamar, hargaSewa: rooms.hargaSewa });
    if (!tujuan) {
      const [ada] = await tx
        .select({ nomorKamar: rooms.nomorKamar, aktif: rooms.aktif })
        .from(rooms)
        .where(and(eq(rooms.id, input.keRoomId), eq(rooms.organizationId, organizationId)));
      if (!ada) throw new GalatAksi("Kamar tujuan tidak ditemukan.", 404);
      throw new GalatAksi(`Kamar ${ada.nomorKamar} ${ada.aktif ? "sudah terisi" : "sedang nonaktif"}.`, 409);
    }

    const hargaSewa = input.sewa === "ikut_kamar" ? tujuan.hargaSewa : penghuni.hargaSewa;
    await tx.update(rooms).set({ status: "kosong" }).where(eq(rooms.id, input.dariRoomId));
    await tx.update(tenants).set({ roomId: input.keRoomId, hargaSewa }).where(eq(tenants.id, penghuni.id));
    if (hunian) {
      await tx
        .update(riwayatHunian)
        .set({ tanggalSelesai: input.tanggal, alasanSelesai: `pindah ke ${tujuan.nomorKamar}` })
        .where(eq(riwayatHunian.id, hunian.id));
    }
    await tx.insert(riwayatHunian).values({
      organizationId,
      tenantId: penghuni.id,
      roomId: input.keRoomId,
      tanggalMulai: input.tanggal,
      hargaSewa,
    });

    return { nama: penghuni.nama, dari: penghuni.nomorKamar, ke: tujuan.nomorKamar, hargaSewa };
  });
}
