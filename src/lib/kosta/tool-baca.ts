// Tool baca Kosta: menjawab pertanyaan owner dengan angka langsung dari database (bukan dari AI).
// Setiap tool mengembalikan teks singkat + lampiran terstruktur untuk ditampilkan/dikirim.

import { and, asc, eq, sql } from "drizzle-orm";

import { schema, type Db } from "../../db/index.ts";
import { getKamarKosong } from "../data/kamar.ts";
import { getRekapPemasukan } from "../data/pemasukan.ts";
import { formatPeriode, formatRupiah, formatTanggal, formatTanggalPendek, selisihHari } from "../format.ts";
import { tanggalWib } from "../waktu.ts";
import { hariKosong } from "../kamar-kosong.ts";
import type { LampiranKosta } from "@/lib/types";

const { invoices, rooms, tenants } = schema;

export type BalasanKosta = { teks: string; lampiran?: LampiranKosta };

/**
 * Tagihan yang sudah lewat jatuh tempo — yang paling lama telat di atas. Tanpa periode = semua periode
 * (tunggakan bulan lalu tetap tunggakan).
 */
export async function toolTunggakan(
  db: Db,
  organizationId: string,
  { periode, hariIni }: { periode?: string; hariIni: string },
): Promise<BalasanKosta> {
  const baris = await db
    .select({
      periode: invoices.periode,
      nominal: invoices.nominal,
      jatuhTempo: invoices.jatuhTempo,
      nomorKamar: rooms.nomorKamar,
      nama: tenants.nama,
    })
    .from(invoices)
    .innerJoin(tenants, eq(tenants.id, invoices.tenantId))
    .innerJoin(rooms, eq(rooms.id, invoices.roomId))
    .where(
      and(
        eq(invoices.organizationId, organizationId),
        eq(invoices.status, "jatuh_tempo"),
        periode ? eq(invoices.periode, periode) : undefined,
      ),
    )
    .orderBy(asc(invoices.jatuhTempo), asc(rooms.nomorKamar));

  const cakupan = periode ? ` untuk ${formatPeriode(periode)}` : "";
  if (baris.length === 0) {
    return { teks: `Tidak ada tunggakan${cakupan}. Semua tagihan yang lewat jatuh tempo sudah dibayar.` };
  }

  const total = baris.reduce((jumlah, b) => jumlah + b.nominal, 0);
  const periodeBerjalan = hariIni.slice(0, 7);
  return {
    teks: `Ada ${baris.length} tagihan yang sudah lewat jatuh tempo${cakupan}, total ${formatRupiah(total)}.`,
    lampiran: {
      jenis: "daftar_tagihan",
      judul: periode ? `Tunggakan ${formatPeriode(periode)}` : `Tunggakan per ${formatTanggal(hariIni)}`,
      baris: baris.map((b) => ({
        nomorKamar: b.nomorKamar,
        nama: b.nama,
        nominal: b.nominal,
        keterangan: [
          `lewat ${selisihHari(b.jatuhTempo, hariIni)} hari`,
          !periode && b.periode !== periodeBerjalan ? formatPeriode(b.periode) : "",
        ]
          .filter(Boolean)
          .join(" · "),
      })),
      total,
    },
  };
}

/** Kamar kosong per tipe, potensi sewa, dan sudah berapa lama kosong. */
export async function toolKamarKosong(
  db: Db,
  organizationId: string,
  { hariIni }: { hariIni: string },
): Promise<BalasanKosta> {
  const kamar = await getKamarKosong(db, organizationId);
  if (kamar.length === 0) {
    const [ada] = await db.select({ id: rooms.id }).from(rooms).where(eq(rooms.organizationId, organizationId)).limit(1);
    return {
      teks: ada
        ? "Semua kamar sudah terisi. Tidak ada kamar kosong saat ini."
        : "Belum ada kamar yang terdaftar di kos ini. Tambahkan dulu lewat menu Kamar & Penghuni.",
    };
  }

  const perTipe = new Map<string, string[]>();
  for (const k of kamar) perTipe.set(k.tipe, [...(perTipe.get(k.tipe) ?? []), k.nomorKamar]);
  const daftar = [...perTipe].map(([tipe, nomor]) => `${nomor.join(", ")} (${tipe})`).join(", ");
  const potensi = kamar.reduce((jumlah, k) => jumlah + k.hargaSewa, 0);

  return {
    teks: `${kamar.length} kamar masih kosong: ${daftar}. Potensi sewa ${formatRupiah(potensi)}/bulan.`,
    lampiran: {
      jenis: "rekap",
      judul: "Kamar kosong",
      baris: kamar.map((k) => {
        const hari = hariKosong(k.kosongSejak, hariIni);
        return {
          label: `${k.nomorKamar} · ${k.tipe}`,
          nominal: k.hargaSewa,
          catatan: hari === undefined ? "belum ada riwayat penghuni" : `kosong ${hari} hari`,
        };
      }),
    },
  };
}

/**
 * Rekap pemasukan satu periode (bawaan bulan berjalan): uang yang sudah masuk dari pembayaran
 * terverifikasi, plus tagihan yang masih menunggu, jatuh tempo, dan perlu review.
 */
export async function toolRekapPemasukan(
  db: Db,
  organizationId: string,
  { periode, hariIni }: { periode?: string; hariIni: string },
): Promise<BalasanKosta> {
  const p = periode ?? hariIni.slice(0, 7);
  const { tagihan, pemasukan } = await getRekapPemasukan(db, organizationId, { periode: p });
  if (tagihan.total.jumlah === 0 && pemasukan.jumlahPembayaran === 0) {
    return { teks: `Belum ada tagihan maupun pembayaran untuk ${formatPeriode(p)}.` };
  }

  const baris: { label: string; nominal: number; catatan?: string }[] = [
    { label: "Sudah masuk", nominal: pemasukan.bulanIni, catatan: `${pemasukan.jumlahPembayaran} pembayaran` },
  ];
  for (const [label, rekap, tambahan] of [
    ["Menunggu", tagihan.menunggu, ""],
    ["Jatuh tempo", tagihan.jatuhTempo, ""],
    ["Perlu review", tagihan.perluReview, " · nominal bayar belum cocok"],
  ] as const) {
    if (rekap.jumlah > 0) baris.push({ label, nominal: rekap.nominal, catatan: `${rekap.jumlah} tagihan${tambahan}` });
  }

  return {
    teks: `Ini rekap pemasukan ${p === hariIni.slice(0, 7) ? "bulan berjalan" : formatPeriode(p)}, dihitung dari pembayaran yang sudah terverifikasi.`,
    lampiran: { jenis: "rekap", judul: `Pemasukan ${formatPeriode(p)}`, baris },
  };
}

/** Status tagihan satu kamar di satu periode (bawaan bulan berjalan), mis. "A03 sudah bayar belum?". */
export async function toolCekKamar(
  db: Db,
  organizationId: string,
  { nomorKamar, periode, hariIni }: { nomorKamar: string; periode?: string; hariIni: string },
): Promise<BalasanKosta> {
  const p = periode ?? hariIni.slice(0, 7);
  const [kamar] = await db
    .select({ id: rooms.id, nomorKamar: rooms.nomorKamar, status: rooms.status })
    .from(rooms)
    .where(and(eq(rooms.organizationId, organizationId), sql`upper(${rooms.nomorKamar}) = ${nomorKamar.toUpperCase()}`));
  if (!kamar) return { teks: `Kamar ${nomorKamar} tidak ditemukan di kos ini.` };

  const [inv] = await db
    .select({
      nominal: invoices.nominal,
      jatuhTempo: invoices.jatuhTempo,
      status: invoices.status,
      dibayarPada: invoices.dibayarPada,
      nama: tenants.nama,
    })
    .from(invoices)
    .innerJoin(tenants, eq(tenants.id, invoices.tenantId))
    .where(and(eq(invoices.organizationId, organizationId), eq(invoices.roomId, kamar.id), eq(invoices.periode, p)));
  if (!inv) {
    return {
      teks:
        kamar.status === "kosong"
          ? `Kamar ${kamar.nomorKamar} sedang kosong, jadi tidak ada tagihan ${formatPeriode(p)}.`
          : `Belum ada tagihan kamar ${kamar.nomorKamar} untuk ${formatPeriode(p)}.`,
    };
  }

  const siapa = `Tagihan ${kamar.nomorKamar} (${inv.nama}) ${formatPeriode(p)} sebesar ${formatRupiah(inv.nominal)}`;
  switch (inv.status) {
    case "lunas":
      return { teks: `Sudah. ${siapa} lunas${inv.dibayarPada ? `, dibayar ${formatTanggal(tanggalWib(inv.dibayarPada))}` : ""}.` };
    case "jatuh_tempo":
      return {
        teks: `Belum. ${siapa} sudah lewat jatuh tempo ${selisihHari(inv.jatuhTempo, hariIni)} hari (${formatTanggalPendek(inv.jatuhTempo)}).`,
      };
    case "perlu_review":
      return { teks: `Sudah ada pembayaran masuk, tapi nominalnya belum cocok dengan ${siapa.charAt(0).toLowerCase()}${siapa.slice(1)}. Periksa di menu Pembayaran.` };
    default:
      return { teks: `Belum. ${siapa} masih menunggu pembayaran, jatuh tempo ${formatTanggalPendek(inv.jatuhTempo)}.` };
  }
}
