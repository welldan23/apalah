// Aksi tiket keluhan:
// - penyewa membuat tiket lewat token link invoice (POST /api/invoice/[token]/tiket);
// - owner/admin memajukan status Baru → Diproses → Selesai (PATCH /api/dashboard/tiket/[id]),
//   lalu penyewa diberi kabar lewat WhatsApp.

import { and, desc, eq, max, sql } from "drizzle-orm";

import { schema, type Db } from "../../db/index.ts";
import { getTiketKos, keTiketPenyewa, penyewaDariToken } from "../data/tiket.ts";
import { pesanTiket, templateTiket } from "../pesan.ts";
import { formatNomorTiket, labelKategori, periksaTiket, statusBerikutnya, type KategoriTiket, type TiketKos, type TiketPenyewa } from "../tiket.ts";
import type { PengirimWhatsApp } from "../whatsapp/index.ts";
import { kirimDanCatat } from "../whatsapp/log.ts";
import { GalatAksi } from "./galat.ts";

const { invoices, organizations, rooms, tenants, tickets } = schema;

/** Batas tiket berstatus Baru per penyewa — mencegah laporan dobel/spam lewat tautan publik. */
export const MAKS_TIKET_BARU = 5;

export function bacaInputTiket(body: Record<string, unknown>): { kategori: KategoriTiket; deskripsi: string } {
  const kategori = typeof body.kategori === "string" ? body.kategori : "";
  const deskripsi = typeof body.deskripsi === "string" ? body.deskripsi.trim() : "";
  const galat = periksaTiket({ kategori, deskripsi });
  const pesan = galat.kategori ?? galat.deskripsi;
  if (pesan) throw new GalatAksi(pesan);
  return { kategori: kategori as KategoriTiket, deskripsi };
}

export async function buatTiket(
  db: Db,
  token: string,
  { kategori, deskripsi }: { kategori: KategoriTiket; deskripsi: string },
): Promise<TiketPenyewa> {
  const p = await penyewaDariToken(db, token);
  if (!p) throw new GalatAksi("Tagihan tidak ditemukan.", 404);
  if (p.statusPenyewa !== "aktif") {
    throw new GalatAksi("Kamu sudah tidak tercatat menghuni kos ini, jadi tiket tidak bisa dibuat lewat tautan ini.", 409);
  }

  return db.transaction(async (tx) => {
    // Kunci kos supaya nomor tiket urut tanpa bentrok saat dua tiket masuk bersamaan.
    await tx.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, p.organizationId)).for("update");
    const [{ baru }] = await tx
      .select({ baru: sql<number>`count(*)`.mapWith(Number) })
      .from(tickets)
      .where(and(eq(tickets.tenantId, p.tenantId), eq(tickets.status, "baru")));
    if (baru >= MAKS_TIKET_BARU) {
      throw new GalatAksi(`Masih ada ${baru} tiket yang belum ditangani pemilik kos. Tunggu kabarnya dulu, ya.`, 409);
    }
    const [{ terakhir }] = await tx
      .select({ terakhir: max(tickets.nomor) })
      .from(tickets)
      .where(eq(tickets.organizationId, p.organizationId));
    const [tiket] = await tx
      .insert(tickets)
      .values({
        organizationId: p.organizationId,
        tenantId: p.tenantId,
        roomId: p.roomId,
        nomor: (terakhir ?? 0) + 1,
        kategori,
        deskripsi,
      })
      .returning();
    return keTiketPenyewa(tiket);
  });
}

export function bacaInputStatusTiket(body: Record<string, unknown>): "diproses" | "selesai" {
  if (body.status === "diproses" || body.status === "selesai") return body.status;
  throw new GalatAksi("Status tiket hanya bisa diubah ke Diproses atau Selesai.");
}

/** Majukan status satu langkah; 409 bila langkahnya tidak urut atau tiket baru saja diubah orang lain. */
export async function ubahStatusTiket(
  db: Db,
  organizationId: string,
  id: string,
  status: "diproses" | "selesai",
): Promise<TiketKos> {
  const [lama] = await db
    .select({ status: tickets.status })
    .from(tickets)
    .where(and(eq(tickets.id, id), eq(tickets.organizationId, organizationId)));
  if (!lama) throw new GalatAksi("Tiket tidak ditemukan.", 404);
  if (statusBerikutnya(lama.status) !== status) {
    throw new GalatAksi("Status tiket sudah berubah. Muat ulang halaman untuk melihat status terbaru.", 409);
  }
  const diubah = await db
    .update(tickets)
    .set({ status, diperbaruiPada: new Date() })
    .where(and(eq(tickets.id, id), eq(tickets.organizationId, organizationId), eq(tickets.status, lama.status)))
    .returning({ id: tickets.id });
  if (diubah.length === 0) {
    throw new GalatAksi("Status tiket sudah berubah. Muat ulang halaman untuk melihat status terbaru.", 409);
  }
  const [tiket] = await getTiketKos(db, organizationId, id);
  return tiket;
}

/**
 * Kabari penyewa bahwa tiketnya sedang ditangani / selesai. Tautan memakai tagihan terbaru penyewa
 * (akses halaman status tiketnya). true bila pesan terkirim.
 */
export async function kirimKabarTiket(db: Db, id: string, { wa, baseUrl }: { wa: PengirimWhatsApp; baseUrl: string }) {
  const [t] = await db
    .select({
      organizationId: tickets.organizationId,
      tenantId: tickets.tenantId,
      nomor: tickets.nomor,
      kategori: tickets.kategori,
      status: tickets.status,
      namaPenghuni: tenants.nama,
      nomorWa: tenants.nomorWa,
      nomorKamar: rooms.nomorKamar,
      namaKos: organizations.namaKos,
    })
    .from(tickets)
    .innerJoin(tenants, eq(tenants.id, tickets.tenantId))
    .innerJoin(rooms, eq(rooms.id, tickets.roomId))
    .innerJoin(organizations, eq(organizations.id, tickets.organizationId))
    .where(eq(tickets.id, id));
  if (!t || t.status === "baru") return false;
  const [inv] = await db
    .select({ token: invoices.tokenPublik })
    .from(invoices)
    .where(eq(invoices.tenantId, t.tenantId))
    .orderBy(desc(invoices.periode), desc(invoices.diterbitkanPada))
    .limit(1);
  if (!inv) return false;

  const data = {
    namaPenghuni: t.namaPenghuni,
    nomorTiket: formatNomorTiket(t.nomor),
    jenis: labelKategori(t.kategori),
    nomorKamar: t.nomorKamar,
    status: t.status,
  };
  const kirim = await kirimDanCatat(
    db,
    wa,
    {
      ke: t.nomorWa,
      teks: pesanTiket(data, t.namaKos, `${baseUrl}/invoice/${inv.token}/tiket/status`),
      template: templateTiket(data, t.namaKos, inv.token),
    },
    { jenis: "tiket", organizationId: t.organizationId, referensiId: id },
  );
  return kirim.ok;
}
