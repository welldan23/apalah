// Aksi cepat "Tambah penghuni": catat penghuni baru di kamar kosong, kamar jadi terisi.

import { and, eq } from "drizzle-orm";

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
    // Kunci kamar: hanya berhasil bila kamar milik kos ini dan masih kosong.
    const [kamar] = await tx
      .update(rooms)
      .set({ status: "terisi" })
      .where(
        and(
          eq(rooms.id, input.roomId),
          eq(rooms.organizationId, organizationId),
          eq(rooms.status, "kosong"),
        ),
      )
      .returning({ nomorKamar: rooms.nomorKamar });

    if (!kamar) {
      const [ada] = await tx
        .select({ nomorKamar: rooms.nomorKamar })
        .from(rooms)
        .where(and(eq(rooms.id, input.roomId), eq(rooms.organizationId, organizationId)));
      throw ada
        ? new GalatAksi(`Kamar ${ada.nomorKamar} sudah terisi.`, 409)
        : new GalatAksi("Kamar tidak ditemukan.", 404);
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
