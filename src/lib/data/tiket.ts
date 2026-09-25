// Data tiket keluhan dari tabel tickets.
// - Penyewa: lewat token link invoice, hanya tiket milik penyewa invoice itu (bukan penghuni lama kamarnya).
// - Owner/admin: semua tiket kos yang sedang dibuka, lengkap dengan kamar & penghuni pelapor.

import { and, count, eq } from "drizzle-orm";

import { schema, type Db } from "../../db/index.ts";
import { formatNomorTiket, urutkanTiket, type KategoriTiket, type StatusTiket, type TiketKos, type TiketPenyewa } from "../tiket.ts";
import { tokenValid } from "./invoice-publik.ts";

const { invoices, organizations, rooms, tenants, tickets } = schema;

/** Penyewa pemilik token invoice + kamarnya SEKARANG (bisa beda dari kamar di invoice bila pindah). */
export async function penyewaDariToken(db: Db, token: string) {
  if (!tokenValid(token)) return null;
  const [p] = await db
    .select({
      organizationId: tenants.organizationId,
      tenantId: tenants.id,
      roomId: tenants.roomId,
      statusPenyewa: tenants.status,
      namaPenghuni: tenants.nama,
      nomorKamar: rooms.nomorKamar,
      namaKos: organizations.namaKos,
    })
    .from(invoices)
    .innerJoin(tenants, eq(tenants.id, invoices.tenantId))
    .innerJoin(rooms, eq(rooms.id, tenants.roomId))
    .innerJoin(organizations, eq(organizations.id, invoices.organizationId))
    .where(eq(invoices.tokenPublik, token));
  return p ?? null;
}

const kolomTiket = {
  id: tickets.id,
  nomor: tickets.nomor,
  kategori: tickets.kategori,
  deskripsi: tickets.deskripsi,
  status: tickets.status,
  dibuatPada: tickets.dibuatPada,
  diperbaruiPada: tickets.diperbaruiPada,
};

type BarisTiket = { [K in keyof typeof kolomTiket]: (typeof kolomTiket)[K]["_"]["data"] };

export const keTiketPenyewa = (t: BarisTiket): TiketPenyewa => ({
  id: t.id,
  nomor: formatNomorTiket(t.nomor),
  kategori: t.kategori as KategoriTiket,
  deskripsi: t.deskripsi,
  status: t.status,
  dibuatPada: t.dibuatPada.toISOString(),
  diperbaruiPada: t.diperbaruiPada.toISOString(),
});

export type TiketPenyewaHalaman = {
  namaKos: string;
  namaPenghuni: string;
  nomorKamar: string;
  tiket: TiketPenyewa[];
};

/** null bila token tidak dikenal. */
export async function getTiketPenyewa(db: Db, token: string): Promise<TiketPenyewaHalaman | null> {
  const p = await penyewaDariToken(db, token);
  if (!p) return null;
  const baris = await db.select(kolomTiket).from(tickets).where(eq(tickets.tenantId, p.tenantId));
  return {
    namaKos: p.namaKos,
    namaPenghuni: p.namaPenghuni,
    nomorKamar: p.nomorKamar,
    tiket: urutkanTiket(baris.map(keTiketPenyewa)),
  };
}

/** Semua tiket satu kos: yang berjalan dulu, terbaru di atas. */
export async function getTiketKos(db: Db, organizationId: string, id?: string): Promise<TiketKos[]> {
  const baris = await db
    .select({ ...kolomTiket, nomorKamar: rooms.nomorKamar, namaPenghuni: tenants.nama, nomorWa: tenants.nomorWa })
    .from(tickets)
    .innerJoin(rooms, eq(rooms.id, tickets.roomId))
    .innerJoin(tenants, eq(tenants.id, tickets.tenantId))
    .where(and(eq(tickets.organizationId, organizationId), id ? eq(tickets.id, id) : undefined));
  return urutkanTiket(
    baris.map((t) => ({ ...keTiketPenyewa(t), nomorKamar: t.nomorKamar, namaPenghuni: t.namaPenghuni, nomorWa: t.nomorWa })),
  );
}

/** Jumlah tiket per status satu kos — untuk banner dashboard. */
export async function getRingkasanTiket(db: Db, organizationId: string): Promise<Record<StatusTiket, number>> {
  const baris = await db
    .select({ status: tickets.status, jumlah: count() })
    .from(tickets)
    .where(eq(tickets.organizationId, organizationId))
    .groupBy(tickets.status);
  const jumlah: Record<StatusTiket, number> = { baru: 0, diproses: 0, selesai: 0 };
  for (const b of baris) jumlah[b.status] = b.jumlah;
  return jumlah;
}
