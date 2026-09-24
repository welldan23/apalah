// Ringkasan Kos & Kamar dari database — dipakai Dashboard Kos dan endpoint
// GET /api/dashboard/ringkasan. Query selalu dibatasi satu organisasi.

import { and, asc, eq } from "drizzle-orm";

import { schema, type Db } from "../../db/index.ts";
import type { RingkasanKos, RoomTypeSummary } from "@/lib/types";

const { organizations, rooms, tenants } = schema;

/** null bila organisasi tidak ada. */
export async function getRingkasanKos(
  db: Db,
  organizationId: string,
): Promise<RingkasanKos | null> {
  const [organization] = await db
    .select({
      id: organizations.id,
      namaKos: organizations.namaKos,
      alamat: organizations.alamat,
      jumlahKamar: organizations.jumlahKamar,
    })
    .from(organizations)
    .where(eq(organizations.id, organizationId));
  if (!organization) return null;

  const baris = await db
    .select({
      id: rooms.id,
      nomorKamar: rooms.nomorKamar,
      tipe: rooms.tipe,
      hargaSewa: rooms.hargaSewa,
      status: rooms.status,
      namaPenghuni: tenants.nama,
      hargaSewaPenghuni: tenants.hargaSewa,
    })
    .from(rooms)
    .leftJoin(tenants, and(eq(tenants.roomId, rooms.id), eq(tenants.status, "aktif")))
    .where(eq(rooms.organizationId, organizationId))
    .orderBy(asc(rooms.nomorKamar));

  const daftar = baris.map(({ namaPenghuni, hargaSewaPenghuni, ...kamar }) => ({
    ...kamar,
    namaPenghuni: namaPenghuni ?? undefined,
    hargaSewaPenghuni: hargaSewaPenghuni ?? undefined,
  }));

  const perTipe = new Map<string, RoomTypeSummary>();
  for (const kamar of daftar) {
    const ringkasan = perTipe.get(kamar.tipe) ?? {
      tipe: kamar.tipe,
      hargaSewa: kamar.hargaSewa,
      total: 0,
      terisi: 0,
    };
    ringkasan.total += 1;
    if (kamar.status === "terisi") ringkasan.terisi += 1;
    perTipe.set(kamar.tipe, ringkasan);
  }

  const terisi = daftar.filter((k) => k.status === "terisi").length;
  return {
    organization,
    kamar: {
      total: daftar.length,
      terisi,
      kosong: daftar.length - terisi,
      perTipe: [...perTipe.values()],
      daftar,
    },
  };
}
