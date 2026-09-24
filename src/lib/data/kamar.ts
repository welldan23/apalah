// Daftar kamar beserta penghuni aktifnya — untuk halaman Kamar & Penghuni.
// Query selalu dibatasi satu organisasi.

import { and, asc, eq } from "drizzle-orm";

import { schema, type Db } from "../../db/index.ts";
import type { RoomStatus } from "@/lib/types";

const { rooms, tenants } = schema;

export type KamarPenghuni = {
  id: string;
  nomorKamar: string;
  tipe: string;
  /** Harga sewa kamar (daftar harga). */
  hargaSewa: number;
  status: RoomStatus;
  catatan?: string;
  penghuni?: {
    id: string;
    nama: string;
    nomorWa: string;
    tanggalMasuk: string;
    /** Harga sewa yang disepakati penghuni. */
    hargaSewa: number;
  };
};

export async function getDaftarKamarPenghuni(db: Db, organizationId: string): Promise<KamarPenghuni[]> {
  const baris = await db
    .select({
      id: rooms.id,
      nomorKamar: rooms.nomorKamar,
      tipe: rooms.tipe,
      hargaSewa: rooms.hargaSewa,
      status: rooms.status,
      catatan: rooms.catatan,
      penghuniId: tenants.id,
      namaPenghuni: tenants.nama,
      nomorWa: tenants.nomorWa,
      tanggalMasuk: tenants.tanggalMasuk,
      sewaPenghuni: tenants.hargaSewa,
    })
    .from(rooms)
    .leftJoin(tenants, and(eq(tenants.roomId, rooms.id), eq(tenants.status, "aktif")))
    .where(eq(rooms.organizationId, organizationId))
    .orderBy(asc(rooms.nomorKamar));

  return baris.map((b) => ({
    id: b.id,
    nomorKamar: b.nomorKamar,
    tipe: b.tipe,
    hargaSewa: b.hargaSewa,
    status: b.status,
    catatan: b.catatan ?? undefined,
    penghuni:
      b.penghuniId && b.namaPenghuni && b.nomorWa && b.tanggalMasuk && b.sewaPenghuni
        ? {
            id: b.penghuniId,
            nama: b.namaPenghuni,
            nomorWa: b.nomorWa,
            tanggalMasuk: b.tanggalMasuk,
            hargaSewa: b.sewaPenghuni,
          }
        : undefined,
  }));
}
