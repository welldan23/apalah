// Alur preview → konfirmasi aksi Kosta (tabel action_drafts).
// Aksi yang mengubah data / kirim massal selalu dibuat sebagai draft "menunggu_konfirmasi" berisi
// penerima, periode, dan nominal dari database; baru dijalankan setelah owner menyetujui.

import { and, desc, eq, inArray, lt, notInArray } from "drizzle-orm";

import { schema, type Db } from "../../db/index.ts";
import { GalatAksi } from "../aksi/galat.ts";
import { kirimReminder } from "../aksi/reminder.ts";
import { sisipkanTagihan } from "../aksi/tagihan.ts";
import { getPengaturanTagihanTerjadwal } from "../aksi/tagihan-terjadwal.ts";
import { formatPeriode, formatRupiah, formatTanggal, periodeBerikutnya } from "../format.ts";
import { jatuhTempoUntuk } from "../tagihan-terjadwal.ts";
import type { PengirimWhatsApp } from "../whatsapp/index.ts";
import { kodeAksi } from "./kode-aksi.ts";
import type { DataDraftAksi, PreviewAksi, StatusDraftAksi } from "@/lib/types";

const { actionDrafts, invoices, rooms, tenants } = schema;

/** Preview lebih lama dari ini harus diminta ulang — datanya bisa sudah berubah. */
export const MASA_BERLAKU_DRAFT_MS = 24 * 60 * 60 * 1000;

type Pemilik = { organizationId: string; userId: string; conversationId?: string | null };

const urutKamar = <T extends { nomorKamar: string }>(a: T, b: T) =>
  a.nomorKamar.localeCompare(b.nomorKamar, "id", { numeric: true });

async function simpanDraft(db: Db, pemilik: Pemilik, data: DataDraftAksi): Promise<PreviewAksi> {
  // Preview baru menggantikan preview lama yang belum diputuskan di percakapan yang sama,
  // supaya jawaban "ya" tidak menyetujui preview yang sudah basi.
  if (pemilik.conversationId) {
    await db
      .update(actionDrafts)
      .set({ status: "dibatalkan", dikonfirmasiPada: new Date() })
      .where(
        and(
          eq(actionDrafts.conversationId, pemilik.conversationId),
          eq(actionDrafts.status, "menunggu_konfirmasi"),
        ),
      );
  }
  const [draft] = await db
    .insert(actionDrafts)
    .values({
      organizationId: pemilik.organizationId,
      userId: pemilik.userId,
      conversationId: pemilik.conversationId ?? null,
      jenisAksi: data.aksi,
      ringkasanPreview: data,
    })
    .returning({ id: actionDrafts.id });
  const { aksi, periode, penerima, total } = data;
  return { aksi, periode, penerima, total, status: "menunggu_konfirmasi", draftId: draft.id };
}

/**
 * Draft pengingat untuk semua tagihan jatuh tempo (kecuali `kecuali`); null bila tidak ada yang menunggak.
 */
export async function siapkanDraftReminder(
  db: Db,
  pemilik: Pemilik,
  { kecuali = [] }: { kecuali?: string[] } = {},
): Promise<PreviewAksi | null> {
  const tunggakan = await db
    .select({
      id: invoices.id,
      periode: invoices.periode,
      nominal: invoices.nominal,
      nomorKamar: rooms.nomorKamar,
      nama: tenants.nama,
    })
    .from(invoices)
    .innerJoin(tenants, eq(tenants.id, invoices.tenantId))
    .innerJoin(rooms, eq(rooms.id, invoices.roomId))
    .where(
      and(
        eq(invoices.organizationId, pemilik.organizationId),
        eq(invoices.status, "jatuh_tempo"),
        kecuali.length ? notInArray(invoices.id, kecuali) : undefined,
      ),
    );
  if (tunggakan.length === 0) return null;
  tunggakan.sort(urutKamar);

  return simpanDraft(db, pemilik, {
    aksi: "reminder",
    periode: tunggakan.map((t) => t.periode).sort().at(-1)!,
    penerima: tunggakan.map(({ nomorKamar, nama, nominal }) => ({ nomorKamar, nama, nominal })),
    total: tunggakan.reduce((jumlah, t) => jumlah + t.nominal, 0),
    invoiceIds: tunggakan.map((t) => t.id),
  });
}

/**
 * Draft tagihan sewa satu periode untuk penghuni aktif yang belum punya tagihan periode itu.
 * Jatuh tempo mengikuti aturan tagihan terjadwal kos. null bila semua sudah ditagih.
 */
export async function siapkanDraftTagihan(db: Db, pemilik: Pemilik, periode: string): Promise<PreviewAksi | null> {
  const sudahDitagih = db
    .select({ id: invoices.tenantId })
    .from(invoices)
    .where(and(eq(invoices.organizationId, pemilik.organizationId), eq(invoices.periode, periode)));
  const penghuni = await db
    .select({
      tenantId: tenants.id,
      roomId: tenants.roomId,
      nama: tenants.nama,
      tanggalMasuk: tenants.tanggalMasuk,
      sewa: tenants.hargaSewa,
      nomorKamar: rooms.nomorKamar,
    })
    .from(tenants)
    .innerJoin(rooms, eq(rooms.id, tenants.roomId))
    .where(
      and(
        eq(tenants.organizationId, pemilik.organizationId),
        eq(tenants.status, "aktif"),
        lt(tenants.tanggalMasuk, `${periodeBerikutnya(periode)}-01`),
        notInArray(tenants.id, sudahDitagih),
      ),
    )
  if (penghuni.length === 0) return null;
  penghuni.sort(urutKamar);

  const { jatuhTempo: aturan } = await getPengaturanTagihanTerjadwal(db, pemilik.organizationId);
  return simpanDraft(db, pemilik, {
    aksi: "tagihan",
    periode,
    penerima: penghuni.map(({ nomorKamar, nama, sewa }) => ({ nomorKamar, nama, nominal: sewa })),
    total: penghuni.reduce((jumlah, p) => jumlah + p.sewa, 0),
    tagihan: penghuni.map((p) => ({
      tenantId: p.tenantId,
      roomId: p.roomId,
      periode,
      jatuhTempo: jatuhTempoUntuk(aturan, periode, p.tanggalMasuk),
      sewa: p.sewa,
    })),
  });
}

/** Draft terbaru yang masih menunggu konfirmasi di sebuah percakapan (untuk balasan "ya"/"batal"). */
export async function draftMenungguTerakhir(db: Db, conversationId: string, organizationId: string) {
  const [draft] = await db
    .select({ id: actionDrafts.id })
    .from(actionDrafts)
    .where(
      and(
        eq(actionDrafts.conversationId, conversationId),
        eq(actionDrafts.organizationId, organizationId),
        eq(actionDrafts.status, "menunggu_konfirmasi"),
      ),
    )
    .orderBy(desc(actionDrafts.dibuatPada))
    .limit(1);
  return draft?.id ?? null;
}

/**
 * Draft di percakapan & kos ini yang kode aksinya cocok (status apa pun) — untuk "YA 482913".
 * null bila tidak ada; kode dari percakapan atau kos lain tidak pernah cocok.
 */
export async function cariDraftDenganKode(db: Db, conversationId: string, organizationId: string, kode: string) {
  const daftar = await db
    .select({ id: actionDrafts.id, status: actionDrafts.status })
    .from(actionDrafts)
    .where(and(eq(actionDrafts.conversationId, conversationId), eq(actionDrafts.organizationId, organizationId)))
    .orderBy(desc(actionDrafts.dibuatPada))
    .limit(100);
  return daftar.find((d) => kodeAksi(d.id) === kode) ?? null;
}

/**
 * Batalkan otomatis draft yang menunggu lebih dari MASA_BERLAKU_DRAFT_MS (dijalankan cron harian),
 * supaya tidak ada preview basi yang tertinggal. Mengembalikan draft yang dikedaluwarsakan.
 */
export async function kedaluwarsakanDraft(db: Db, sekarang = new Date()) {
  return db
    .update(actionDrafts)
    .set({ status: "dibatalkan", dikonfirmasiPada: sekarang })
    .where(
      and(
        eq(actionDrafts.status, "menunggu_konfirmasi"),
        lt(actionDrafts.dibuatPada, new Date(sekarang.getTime() - MASA_BERLAKU_DRAFT_MS)),
      ),
    )
    .returning({ id: actionDrafts.id, organizationId: actionDrafts.organizationId, userId: actionDrafts.userId });
}

export type HasilKeputusan = {
  aksi: DataDraftAksi["aksi"];
  conversationId: string | null;
  status: StatusDraftAksi;
  /** Balasan singkat Kosta untuk owner. */
  balasan: string;
  /** true bila dibatalkan karena preview sudah lewat masa berlakunya. */
  kedaluwarsa?: boolean;
};

const SUDAH_DIPUTUSKAN = () => new GalatAksi("Draft ini sudah diputuskan sebelumnya.", 409);

async function ubahStatus(db: Db, id: string, dari: StatusDraftAksi, ke: StatusDraftAksi, dikonfirmasiPada?: Date) {
  const [baris] = await db
    .update(actionDrafts)
    .set({ status: ke, ...(dikonfirmasiPada ? { dikonfirmasiPada } : {}) })
    .where(and(eq(actionDrafts.id, id), eq(actionDrafts.status, dari)))
    .returning({ id: actionDrafts.id });
  return !!baris;
}

async function ambilDraftMenunggu(db: Db, draftId: string, organizationId: string) {
  const [draft] = await db
    .select()
    .from(actionDrafts)
    .where(and(eq(actionDrafts.id, draftId), eq(actionDrafts.organizationId, organizationId)));
  if (!draft) throw new GalatAksi("Draft tidak ditemukan.", 404);
  if (draft.status !== "menunggu_konfirmasi") throw SUDAH_DIPUTUSKAN();
  return draft;
}

const kedaluwarsa = (draft: { dibuatPada: Date }, sekarang: Date) =>
  sekarang.getTime() - draft.dibuatPada.getTime() > MASA_BERLAKU_DRAFT_MS;

/** Batalkan draft yang masih menunggu konfirmasi; tidak ada data yang diubah atau dikirim. */
export async function batalkanDraft(
  db: Db,
  { draftId, organizationId, sekarang = new Date() }: { draftId: string; organizationId: string; sekarang?: Date },
): Promise<HasilKeputusan> {
  const draft = await ambilDraftMenunggu(db, draftId, organizationId);
  if (!(await ubahStatus(db, draftId, "menunggu_konfirmasi", "dibatalkan", sekarang))) throw SUDAH_DIPUTUSKAN();
  return {
    aksi: draft.jenisAksi,
    conversationId: draft.conversationId,
    status: "dibatalkan",
    balasan: "Oke, dibatalkan. Tidak ada yang dikirim atau diubah.",
  };
}

/**
 * Keputusan owner atas draft. Perpindahan status atomik (menunggu → disetujui) sehingga konfirmasi
 * ganda tidak menjalankan aksi dua kali. Target dicek ulang saat dijalankan.
 */
export async function putuskanDraft(
  db: Db,
  { draftId, organizationId, keputusan }: { draftId: string; organizationId: string; keputusan: "setuju" | "batal" },
  deps: { wa: PengirimWhatsApp; baseUrl: string; sekarang?: Date },
): Promise<HasilKeputusan> {
  const sekarang = deps.sekarang ?? new Date();
  if (keputusan === "batal") return batalkanDraft(db, { draftId, organizationId, sekarang });

  const draft = await ambilDraftMenunggu(db, draftId, organizationId);
  if (kedaluwarsa(draft, sekarang)) {
    const hasil = await batalkanDraft(db, { draftId, organizationId, sekarang });
    return {
      ...hasil,
      kedaluwarsa: true,
      balasan: "Preview ini sudah lebih dari 24 jam, jadi aku batalkan. Minta ulang supaya datanya terbaru.",
    };
  }

  if (!(await ubahStatus(db, draftId, "menunggu_konfirmasi", "disetujui", sekarang))) {
    throw SUDAH_DIPUTUSKAN();
  }
  const data = draft.ringkasanPreview;
  const balasan =
    data.aksi === "reminder"
      ? await jalankanReminder(db, organizationId, data, deps)
      : await jalankanTagihan(db, organizationId, data);
  await ubahStatus(db, draftId, "disetujui", "dijalankan");
  return { aksi: draft.jenisAksi, conversationId: draft.conversationId, status: "dijalankan", balasan };
}

async function jalankanReminder(
  db: Db,
  organizationId: string,
  data: DataDraftAksi,
  { wa, baseUrl }: { wa: PengirimWhatsApp; baseUrl: string },
) {
  const target = data.invoiceIds ?? [];
  // Hanya yang masih jatuh tempo — yang sudah bayar sejak preview dibuat tidak diingatkan.
  const masih = target.length
    ? await db
        .select({ id: invoices.id })
        .from(invoices)
        .where(
          and(
            eq(invoices.organizationId, organizationId),
            eq(invoices.status, "jatuh_tempo"),
            inArray(invoices.id, target),
          ),
        )
    : [];
  const dilewati = target.length - masih.length;
  if (masih.length === 0) return "Semua tagihan di preview sudah dibayar, jadi tidak ada pengingat yang dikirim.";

  const hasil = await kirimReminder(db, organizationId, { invoiceIds: masih.map((m) => m.id) }, wa, { baseUrl });
  return [
    hasil.terkirim || hasil.gagal.length ? `Pengingat terkirim ke ${hasil.terkirim} penyewa.` : "Tidak ada pengingat yang dikirim.",
    hasil.gagal.length ? `Gagal ke kamar ${hasil.gagal.join(", ")}.` : "",
    dilewati ? `${dilewati} tagihan dilewati karena sudah dibayar.` : "",
    hasil.dilewati.length
      ? `Kamar ${hasil.dilewati.join(", ")} dilewati karena penyewanya sudah dihubungi dalam 24 jam terakhir.`
      : "",
    hasil.simulasi ? "(Mode pengembangan: pesan hanya dicatat.)" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

async function jalankanTagihan(db: Db, organizationId: string, data: DataDraftAksi) {
  const dibuat = await sisipkanTagihan(db, organizationId, data.tagihan ?? []);
  const total = dibuat.reduce((jumlah, inv) => jumlah + inv.nominal, 0);
  const dilewati = (data.tagihan?.length ?? 0) - dibuat.length;
  return [
    `${dibuat.length} tagihan ${formatPeriode(data.periode)} dibuat, total ${formatRupiah(total)}.`,
    dilewati ? `${dilewati} penghuni dilewati karena sudah punya tagihan.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export type KoreksiDraft = {
  /** Nomor kamar yang tidak jadi ditagih. */
  kecualikan?: string[];
  /** Nominal sewa baru per kamar. */
  nominal?: { nomorKamar: string; nominal: number }[];
  /** Tanggal jatuh tempo baru (1–31, dipotong ke akhir bulan) untuk semua tagihan di draft. */
  tanggalJatuhTempo?: number;
};

/**
 * Koreksi draft tagihan yang masih menunggu konfirmasi. Hasilnya draft BARU (preview baru untuk
 * dikonfirmasi) dan draft lama dibatalkan — owner selalu menyetujui persis yang terakhir ia lihat.
 * preview null bila semua kamar dikecualikan (draft dibatalkan).
 */
export async function koreksiDraftTagihan(
  db: Db,
  { draftId, organizationId, sekarang = new Date() }: { draftId: string; organizationId: string; sekarang?: Date },
  koreksi: KoreksiDraft,
): Promise<{ preview: PreviewAksi | null; perubahan: string[] }> {
  const draft = await ambilDraftMenunggu(db, draftId, organizationId);
  const data = draft.ringkasanPreview;
  if (data.aksi !== "tagihan" || !data.tagihan) throw new GalatAksi("Koreksi hanya untuk draft tagihan.", 409);
  if (kedaluwarsa(draft, sekarang)) throw new GalatAksi("Draft ini sudah kedaluwarsa. Minta draft baru.", 409);

  const baris = data.penerima.map((p, i) => ({ penerima: { ...p }, tagihan: { ...data.tagihan![i] } }));
  const disebut = [...(koreksi.kecualikan ?? []), ...(koreksi.nominal ?? []).map((n) => n.nomorKamar)];
  const tidakAda = disebut.filter((k) => !baris.some((b) => b.penerima.nomorKamar === k));
  if (tidakAda.length) throw new GalatAksi(`Kamar ${[...new Set(tidakAda)].join(", ")} tidak ada di draft ini.`);

  const perubahan: string[] = [];
  const dikecualikan = new Set(koreksi.kecualikan ?? []);
  if (dikecualikan.size) perubahan.push(`${[...dikecualikan].join(", ")} dikecualikan`);
  for (const { nomorKamar, nominal } of koreksi.nominal ?? []) {
    const b = baris.find((x) => x.penerima.nomorKamar === nomorKamar)!;
    b.penerima.nominal = nominal;
    b.tagihan.sewa = nominal;
    perubahan.push(`${nomorKamar} jadi ${formatRupiah(nominal)}`);
  }
  if (koreksi.tanggalJatuhTempo) {
    const jatuhTempo = jatuhTempoUntuk({ aturan: "tanggal_tetap", tanggal: koreksi.tanggalJatuhTempo }, data.periode, "");
    for (const b of baris) b.tagihan.jatuhTempo = jatuhTempo;
    perubahan.push(`jatuh tempo ${formatTanggal(jatuhTempo)}`);
  }

  await ubahStatus(db, draftId, "menunggu_konfirmasi", "dibatalkan", sekarang);
  const sisa = baris.filter((b) => !dikecualikan.has(b.penerima.nomorKamar));
  if (sisa.length === 0) return { preview: null, perubahan };

  const preview = await simpanDraft(
    db,
    { organizationId, userId: draft.userId, conversationId: draft.conversationId },
    {
      aksi: "tagihan",
      periode: data.periode,
      penerima: sisa.map((b) => b.penerima),
      total: sisa.reduce((jumlah, b) => jumlah + b.penerima.nominal, 0),
      tagihan: sisa.map((b) => b.tagihan),
    },
  );
  return { preview, perubahan };
}
