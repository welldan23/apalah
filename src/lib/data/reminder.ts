// Data pengingat bayar dari tabel reminders — riwayat & statistik per kos.
// Pesan non-pengingat (kirim tagihan, konfirmasi lunas) tidak ikut dihitung.

import { and, desc, eq, gte, ilike, inArray, lt, max, ne, notInArray, or, sql } from "drizzle-orm";

import { schema, type Db } from "../../db/index.ts";
import { periodeBerikutnya } from "../format.ts";
import { GALAT_TERPUTUS, JENIS_BUKAN_PENGINGAT, parseStatusRiwayat, STATUS_RIWAYAT, type StatusRiwayat } from "../reminder.ts";
import { periodeValid } from "../waktu.ts";
import { getDaftarInvoice } from "./invoice.ts";
import type { InvoiceRow } from "@/lib/types";

const { invoices, reminders, rooms, tenants } = schema;

export type RiwayatReminder = {
  id: string;
  jenis: string;
  status: "terkirim" | "gagal";
  /** ISO datetime. */
  terkirimPada: string;
  nomorKamar: string;
  namaPenghuni: string;
  periode: string;
  nominal: number;
  /** Alasan gagal dari provider WhatsApp. */
  galat?: string;
};

const awalBulanWib = (periode: string) => new Date(`${periode}-01T00:00:00+07:00`);

/**
 * Baris reminders yang berarti "penyewa sudah dihubungi" untuk aturan satu pesan per 24 jam:
 * pesan selain konfirmasi lunas yang terkirim atau sedang dikirim (klaim). Kiriman gagal tidak dihitung.
 */
export const kontakPenyewa = () =>
  and(ne(reminders.jenis, "konfirmasi_lunas"), or(eq(reminders.status, "terkirim"), eq(reminders.galat, GALAT_TERPUTUS)));

/** Posisi baris terakhir yang sudah dibaca — halaman berikutnya dimulai setelahnya. */
export type KursorRiwayat = { terkirimPada: string; id: string };

export type FilterRiwayatReminder = {
  /** Bulan kirim (WIB), YYYY-MM. */
  periode?: string;
  status?: "terkirim" | "gagal";
  jenis?: string;
  /** Periode tagihan, YYYY-MM. */
  periodeTagihan?: string;
  /** Nama penghuni atau nomor kamar, tanpa beda huruf besar/kecil. */
  cari?: string;
  sebelum?: KursorRiwayat;
  batas?: number;
};

/** Pengingat terbaru di atas (waktu kirim, lalu id), bisa disaring & dibaca per halaman. */
export async function getRiwayatReminder(
  db: Db,
  organizationId: string,
  { periode, status, jenis, periodeTagihan, cari, sebelum, batas = 50 }: FilterRiwayatReminder = {},
): Promise<RiwayatReminder[]> {
  // Wildcard LIKE dari pengguna dianggap huruf biasa.
  const pola = cari?.trim() ? `%${cari.trim().replace(/[\\%_]/g, "\\$&")}%` : undefined;
  const waktuSebelum = sebelum ? new Date(sebelum.terkirimPada) : undefined;
  const baris = await db
    .select({
      id: reminders.id,
      jenis: reminders.jenis,
      status: reminders.status,
      galat: reminders.galat,
      terkirimPada: reminders.terkirimPada,
      nomorKamar: rooms.nomorKamar,
      namaPenghuni: tenants.nama,
      periode: invoices.periode,
      nominal: invoices.nominal,
    })
    .from(reminders)
    .innerJoin(invoices, eq(invoices.id, reminders.invoiceId))
    .innerJoin(tenants, eq(tenants.id, reminders.tenantId))
    .innerJoin(rooms, eq(rooms.id, invoices.roomId))
    .where(
      and(
        eq(reminders.organizationId, organizationId),
        notInArray(reminders.jenis, [...JENIS_BUKAN_PENGINGAT]),
        periode ? gte(reminders.terkirimPada, awalBulanWib(periode)) : undefined,
        periode ? lt(reminders.terkirimPada, awalBulanWib(periodeBerikutnya(periode))) : undefined,
        status ? eq(reminders.status, status) : undefined,
        jenis ? eq(reminders.jenis, jenis) : undefined,
        periodeTagihan ? eq(invoices.periode, periodeTagihan) : undefined,
        pola ? or(ilike(tenants.nama, pola), ilike(rooms.nomorKamar, pola)) : undefined,
        sebelum && waktuSebelum
          ? or(
              lt(reminders.terkirimPada, waktuSebelum),
              and(eq(reminders.terkirimPada, waktuSebelum), lt(reminders.id, sebelum.id)),
            )
          : undefined,
      ),
    )
    .orderBy(desc(reminders.terkirimPada), desc(reminders.id))
    .limit(batas);
  return baris.map(({ galat, ...b }) => ({ ...b, terkirimPada: b.terkirimPada.toISOString(), ...(galat ? { galat } : {}) }));
}

export type QueryRiwayatReminder = {
  /** Bulan kirim YYYY-MM, atau "semua". */
  periode: string;
  status: StatusRiwayat;
  /** "" = semua jenis. */
  jenis: string;
  /** Periode tagihan YYYY-MM; "" = semua. */
  tagihan: string;
  q: string;
  batas: number;
  /** Kursor "ISO|id" dari `berikutnya` respons sebelumnya; "" = halaman pertama. */
  sebelum: string;
};

export const MAKS_BATAS_RIWAYAT = 200;

/**
 * Baca query `?periode=&status=&jenis=&tagihan=&q=&batas=&sebelum=` endpoint riwayat reminder.
 * Periode kosong = bulan berjalan; nilai yang tidak dikenal ditolak dengan pesan galat.
 */
export function bacaFilterRiwayatReminder(
  params: URLSearchParams,
  periodeBerjalan: string,
): { query: QueryRiwayatReminder; filter: FilterRiwayatReminder } | { galat: string } {
  const periode = params.get("periode") || periodeBerjalan;
  const statusMentah = params.get("status") || "semua";
  const jenis = (params.get("jenis") ?? "").trim();
  const tagihan = params.get("tagihan") ?? "";
  const q = (params.get("q") ?? "").trim();
  const batasMentah = params.get("batas") || "50";
  const sebelum = params.get("sebelum") ?? "";

  if (periode !== "semua" && !periodeValid(periode)) return { galat: 'Periode harus berformat YYYY-MM atau "semua".' };
  if (!(STATUS_RIWAYAT as readonly string[]).includes(statusMentah)) return { galat: `Status tidak dikenal: ${statusMentah}` };
  if (jenis.length > 20) return { galat: "Jenis maksimal 20 karakter." };
  if (tagihan && !periodeValid(tagihan)) return { galat: "Periode tagihan harus berformat YYYY-MM." };
  if (q.length > 100) return { galat: "Kata kunci maksimal 100 karakter." };
  const batas = Number(batasMentah);
  if (!Number.isInteger(batas) || batas < 1 || batas > MAKS_BATAS_RIWAYAT) return { galat: `Batas harus 1–${MAKS_BATAS_RIWAYAT}.` };
  let kursor: KursorRiwayat | undefined;
  if (sebelum) {
    const [terkirimPada, id] = sebelum.split("|");
    if (!terkirimPada || !id || Number.isNaN(Date.parse(terkirimPada))) return { galat: "Kursor sebelum tidak valid." };
    kursor = { terkirimPada, id };
  }

  const status = parseStatusRiwayat(statusMentah);
  return {
    query: { periode, status, jenis, tagihan, q, batas, sebelum },
    filter: {
      periode: periode === "semua" ? undefined : periode,
      status: status === "semua" ? undefined : status,
      jenis: jenis || undefined,
      periodeTagihan: tagihan || undefined,
      cari: q || undefined,
      sebelum: kursor,
      batas,
    },
  };
}

/** Kursor untuk halaman sesudah `r`. */
export const kursorSetelah = (r: Pick<RiwayatReminder, "terkirimPada" | "id">) => `${r.terkirimPada}|${r.id}`;

export type StatistikReminder = { terkirim: number; gagal: number; penyewa: number };

/** Jumlah pengingat terkirim/gagal dan penyewa yang diingatkan di satu bulan kirim (WIB). */
export async function getStatistikReminder(db: Db, organizationId: string, periode: string): Promise<StatistikReminder> {
  const [s] = await db
    .select({
      terkirim: sql<number>`count(*) filter (where ${reminders.status} = 'terkirim')`.mapWith(Number),
      gagal: sql<number>`count(*) filter (where ${reminders.status} = 'gagal')`.mapWith(Number),
      penyewa: sql<number>`count(distinct ${reminders.tenantId}) filter (where ${reminders.status} = 'terkirim')`.mapWith(Number),
    })
    .from(reminders)
    .where(
      and(
        eq(reminders.organizationId, organizationId),
        notInArray(reminders.jenis, [...JENIS_BUKAN_PENGINGAT]),
        gte(reminders.terkirimPada, awalBulanWib(periode)),
        lt(reminders.terkirimPada, awalBulanWib(periodeBerikutnya(periode))),
      ),
    );
  return s;
}

export type KandidatReminder = InvoiceRow & {
  /** ISO datetime pesan terakhir yang terkirim ke penyewa untuk tagihan ini. */
  terakhirDiingatkan?: string;
};

/**
 * Tagihan yang belum lunas (menunggu, terkirim, jatuh tempo) — kandidat penerima reminder massal —
 * beserta kapan terakhir penyewanya dihubungi soal tagihan itu.
 */
export async function getKandidatReminder(db: Db, organizationId: string): Promise<KandidatReminder[]> {
  const tagihan = (await getDaftarInvoice(db, organizationId, {})).filter((t) =>
    ["menunggu", "terkirim", "jatuh_tempo"].includes(t.status),
  );
  if (tagihan.length === 0) return [];
  const terakhir = await db
    .select({ invoiceId: reminders.invoiceId, waktu: max(reminders.terkirimPada) })
    .from(reminders)
    .where(
      and(
        eq(reminders.organizationId, organizationId),
        eq(reminders.status, "terkirim"),
        notInArray(reminders.jenis, ["konfirmasi_lunas"]),
        inArray(
          reminders.invoiceId,
          tagihan.map((t) => t.id),
        ),
      ),
    )
    .groupBy(reminders.invoiceId);
  const peta = new Map(terakhir.map((r) => [r.invoiceId, r.waktu]));
  return tagihan.map((t) => {
    const waktu = peta.get(t.id);
    return waktu ? { ...t, terakhirDiingatkan: waktu.toISOString() } : t;
  });
}
