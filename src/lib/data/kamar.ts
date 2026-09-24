// Daftar kamar beserta penghuni aktifnya — untuk halaman Kamar & Penghuni.
// Query selalu dibatasi satu organisasi.

import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";

import { schema, type Db } from "../../db/index.ts";
import type { RoomStatus } from "@/lib/types";

const { invoices, rooms, tenants } = schema;

/** Status tagihan yang belum selesai (belum lunas). */
const STATUS_TERBUKA = ["menunggu", "jatuh_tempo", "perlu_review", "terkirim"] as const;

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
    /** Tagihan yang belum lunas milik penghuni ini. */
    tagihanTerbuka: { jumlah: number; nominal: number };
  };
};

export type PenghuniNonaktif = {
  id: string;
  nama: string;
  nomorWa: string;
  /** Kamar terakhir yang ditempati. */
  nomorKamar: string;
  tanggalMasuk: string;
  tanggalKeluar?: string;
  hargaSewa: number;
};

export type KamarKosong = {
  id: string;
  nomorKamar: string;
  tipe: string;
  hargaSewa: number;
  status: "kosong";
  catatan?: string;
  /** Tanggal penghuni terakhir keluar; tidak ada bila kamar belum punya riwayat penghuni. */
  kosongSejak?: string;
  penghuniTerakhir?: string;
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
    .where(and(eq(rooms.organizationId, organizationId), eq(rooms.aktif, true)))
    .orderBy(asc(rooms.nomorKamar));

  const penghuniIds = baris.flatMap((b) => (b.penghuniId ? [b.penghuniId] : []));
  const terbuka = penghuniIds.length
    ? await db
        .select({
          tenantId: invoices.tenantId,
          jumlah: sql<number>`count(*)`.mapWith(Number),
          nominal: sql<number>`coalesce(sum(${invoices.nominal}), 0)`.mapWith(Number),
        })
        .from(invoices)
        .where(
          and(
            eq(invoices.organizationId, organizationId),
            inArray(invoices.tenantId, penghuniIds),
            inArray(invoices.status, [...STATUS_TERBUKA]),
          ),
        )
        .groupBy(invoices.tenantId)
    : [];
  const terbukaPerPenghuni = new Map(terbuka.map((t) => [t.tenantId, t]));

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
            tagihanTerbuka: {
              jumlah: terbukaPerPenghuni.get(b.penghuniId)?.jumlah ?? 0,
              nominal: terbukaPerPenghuni.get(b.penghuniId)?.nominal ?? 0,
            },
          }
        : undefined,
  }));
}

/** Mantan penghuni (status keluar), yang terakhir keluar di atas. */
export async function getPenghuniNonaktif(db: Db, organizationId: string): Promise<PenghuniNonaktif[]> {
  const baris = await db
    .select({
      id: tenants.id,
      nama: tenants.nama,
      nomorWa: tenants.nomorWa,
      nomorKamar: rooms.nomorKamar,
      tanggalMasuk: tenants.tanggalMasuk,
      tanggalKeluar: tenants.tanggalKeluar,
      hargaSewa: tenants.hargaSewa,
    })
    .from(tenants)
    .innerJoin(rooms, eq(rooms.id, tenants.roomId))
    .where(and(eq(tenants.organizationId, organizationId), eq(tenants.status, "keluar")))
    .orderBy(desc(tenants.tanggalKeluar));
  return baris.map((b) => ({ ...b, tanggalKeluar: b.tanggalKeluar ?? undefined }));
}

/** Kamar kosong urut nomor, beserta kapan & siapa penghuni terakhir yang keluar. */
export async function getKamarKosong(db: Db, organizationId: string): Promise<KamarKosong[]> {
  const kosong = await db
    .select({
      id: rooms.id,
      nomorKamar: rooms.nomorKamar,
      tipe: rooms.tipe,
      hargaSewa: rooms.hargaSewa,
      catatan: rooms.catatan,
    })
    .from(rooms)
    .where(and(eq(rooms.organizationId, organizationId), eq(rooms.status, "kosong"), eq(rooms.aktif, true)))
    .orderBy(asc(rooms.nomorKamar));
  if (kosong.length === 0) return [];

  const riwayat = await db
    .select({ roomId: tenants.roomId, nama: tenants.nama, tanggalKeluar: tenants.tanggalKeluar })
    .from(tenants)
    .where(
      and(
        eq(tenants.organizationId, organizationId),
        eq(tenants.status, "keluar"),
        isNotNull(tenants.tanggalKeluar),
        inArray(
          tenants.roomId,
          kosong.map((k) => k.id),
        ),
      ),
    )
    .orderBy(desc(tenants.tanggalKeluar));
  const terakhir = new Map<string, (typeof riwayat)[number]>();
  for (const r of riwayat) if (!terakhir.has(r.roomId)) terakhir.set(r.roomId, r);

  return kosong.map((k) => ({
    ...k,
    status: "kosong",
    catatan: k.catatan ?? undefined,
    kosongSejak: terakhir.get(k.id)?.tanggalKeluar ?? undefined,
    penghuniTerakhir: terakhir.get(k.id)?.nama,
  }));
}

export type KamarNonaktif = { id: string; nomorKamar: string; tipe: string; hargaSewa: number; catatan?: string };

/** Kamar yang dinonaktifkan (mis. renovasi), urut nomor. */
export async function getKamarNonaktif(db: Db, organizationId: string): Promise<KamarNonaktif[]> {
  const baris = await db
    .select({ id: rooms.id, nomorKamar: rooms.nomorKamar, tipe: rooms.tipe, hargaSewa: rooms.hargaSewa, catatan: rooms.catatan })
    .from(rooms)
    .where(and(eq(rooms.organizationId, organizationId), eq(rooms.aktif, false)))
    .orderBy(asc(rooms.nomorKamar));
  return baris.map((k) => ({ ...k, catatan: k.catatan ?? undefined }));
}
