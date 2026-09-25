// Tool aksi Kosta: menyiapkan draft yang MENUNGGU KONFIRMASI owner — belum ada data yang diubah
// atau pesan yang dikirim sampai owner menyetujui preview (lihat putuskanDraft).

import { and, eq, gte, inArray } from "drizzle-orm";

import { schema, type Db } from "../../db/index.ts";
import { formatPeriode, formatRupiah, periodeBerikutnya } from "../format.ts";
import { pesanPengingat, pesanReminder } from "../pesan.ts";
import { STATUS_BISA_DIINGATKAN } from "../reminder.ts";
import {
  batalkanDraft,
  draftMenungguTerakhir,
  koreksiDraftTagihan,
  siapkanDraftReminder,
  siapkanDraftTagihan,
  type KoreksiDraft,
} from "./draft.ts";
import type { BalasanKosta } from "./tool-baca.ts";

const { actionDrafts, invoices, organizations, reminders, rooms, tenants } = schema;

/** Penyewa yang sudah dihubungi dalam rentang ini tidak diingatkan lagi (hindari kesan spam). */
const JEDA_PENGINGAT_MS = 24 * 60 * 60 * 1000;

type Pemilik = { organizationId: string; userId: string; conversationId?: string | null };


/**
 * Draft tagihan sewa. Tanpa periode: bulan berjalan selama masih ada penghuni yang belum ditagih,
 * selain itu bulan depan.
 */
export async function toolDraftTagihan(
  db: Db,
  pemilik: Pemilik,
  { periode, hariIni }: { periode?: string; hariIni: string },
): Promise<BalasanKosta> {
  const berjalan = hariIni.slice(0, 7);
  const preview =
    (await siapkanDraftTagihan(db, pemilik, periode ?? berjalan)) ??
    (periode ? null : await siapkanDraftTagihan(db, pemilik, periodeBerikutnya(berjalan)));

  if (!preview) {
    const cakupan = periode ? formatPeriode(periode) : `${formatPeriode(berjalan)} dan ${formatPeriode(periodeBerikutnya(berjalan))}`;
    return { teks: `Semua penghuni aktif sudah punya tagihan ${cakupan}. Tidak ada draft yang perlu dibuat.` };
  }
  return {
    teks: `Ini draft tagihan ${formatPeriode(preview.periode)} untuk ${preview.penerima.length} penghuni, total ${formatRupiah(preview.total)}. Belum ada tagihan yang dibuat sampai kamu konfirmasi.`,
    lampiran: { jenis: "preview_aksi", ...preview },
  };
}

type Percakapan = { organizationId: string; conversationId: string };

const TIDAK_ADA_DRAFT = "Tidak ada draft yang sedang menunggu konfirmasi.";

/** Koreksi draft tagihan terakhir di percakapan → preview baru yang perlu dikonfirmasi lagi. */
export async function toolKoreksiDraft(
  db: Db,
  { organizationId, conversationId }: Percakapan,
  koreksi: KoreksiDraft,
): Promise<BalasanKosta> {
  const draftId = await draftMenungguTerakhir(db, conversationId, organizationId);
  if (!draftId) return { teks: TIDAK_ADA_DRAFT };
  const { preview, perubahan } = await koreksiDraftTagihan(db, { draftId, organizationId }, koreksi);
  if (!preview) return { teks: "Semua kamar dikecualikan, jadi draft tagihan dibatalkan. Tidak ada tagihan yang dibuat." };
  return {
    teks: `Draft diperbarui (${perubahan.join("; ")}). Sekarang ${preview.penerima.length} penghuni, total ${formatRupiah(preview.total)}. Cek lagi lalu konfirmasi.`,
    lampiran: { jenis: "preview_aksi", ...preview },
  };
}

/** Batalkan draft terakhir yang menunggu konfirmasi di percakapan. */
export async function toolBatalDraft(db: Db, { organizationId, conversationId }: Percakapan): Promise<BalasanKosta> {
  const draftId = await draftMenungguTerakhir(db, conversationId, organizationId);
  if (!draftId) return { teks: TIDAK_ADA_DRAFT };
  return { teks: (await batalkanDraft(db, { draftId, organizationId })).balasan };
}

/**
 * Susun pengingat bayar: tanpa `kamar` untuk semua penyewa yang menunggak, dengan `kamar` hanya untuk
 * tagihan belum dibayar kamar-kamar itu. Preview penerima & total + contoh isi pesan; belum ada pesan
 * terkirim sampai owner mengonfirmasi. Yang sudah dihubungi 24 jam terakhir dilewati.
 */
export async function toolSiapkanReminder(
  db: Db,
  pemilik: Pemilik,
  { kamar = [], hariIni, sekarang = new Date() }: { kamar?: string[]; hariIni?: string; sekarang?: Date } = {},
): Promise<BalasanKosta> {
  // Kamar yang disebut tapi tidak ada di kos ini: tanya ulang, jangan menebak.
  if (kamar.length) {
    const ada = (
      await db
        .select({ nomorKamar: rooms.nomorKamar })
        .from(rooms)
        .where(and(eq(rooms.organizationId, pemilik.organizationId), inArray(rooms.nomorKamar, kamar)))
    ).map((r) => r.nomorKamar);
    const tidakAda = kamar.filter((k) => !ada.includes(k));
    if (tidakAda.length) return { teks: `Kamar ${tidakAda.join(", ")} tidak ada di kos ini. Cek lagi nomor kamarnya, ya.` };
  }

  // Tagihan kandidat yang penyewanya sudah diingatkan dalam 24 jam terakhir.
  const baruDihubungi = (
    await db
      .selectDistinct({ id: reminders.invoiceId })
      .from(reminders)
      .innerJoin(invoices, eq(invoices.id, reminders.invoiceId))
      .where(
        and(
          eq(reminders.organizationId, pemilik.organizationId),
          eq(reminders.status, "terkirim"),
          gte(reminders.terkirimPada, new Date(sekarang.getTime() - JEDA_PENGINGAT_MS)),
          inArray(invoices.status, kamar.length ? [...STATUS_BISA_DIINGATKAN] : ["jatuh_tempo"]),
        ),
      )
  ).map((r) => r.id);

  const preview = await siapkanDraftReminder(db, pemilik, { kecuali: baruDihubungi, kamar });
  if (!preview) {
    if (kamar.length) {
      return {
        teks: `Tidak ada tagihan yang perlu diingatkan untuk kamar ${kamar.join(", ")}: sudah dibayar, belum ditagih, atau penyewanya sudah dihubungi dalam 24 jam terakhir.`,
      };
    }
    return {
      teks: baruDihubungi.length
        ? "Semua penyewa yang menunggak sudah dihubungi dalam 24 jam terakhir. Coba lagi besok supaya tidak terkesan spam."
        : "Tidak ada tagihan yang lewat jatuh tempo, jadi belum ada yang perlu diingatkan.",
    };
  }

  // Contoh pesan untuk penerima pertama — persis template yang akan dikirim.
  const [draft] = await db.select().from(actionDrafts).where(eq(actionDrafts.id, preview.draftId!));
  const [contoh] = await db
    .select({
      namaKos: organizations.namaKos,
      namaPenghuni: tenants.nama,
      nomorKamar: rooms.nomorKamar,
      periode: invoices.periode,
      nominal: invoices.nominal,
      jatuhTempo: invoices.jatuhTempo,
    })
    .from(invoices)
    .innerJoin(organizations, eq(organizations.id, invoices.organizationId))
    .innerJoin(tenants, eq(tenants.id, invoices.tenantId))
    .innerJoin(rooms, eq(rooms.id, invoices.roomId))
    .where(eq(invoices.id, draft.ringkasanPreview.invoiceIds![0]));
  const isiContoh = hariIni
    ? pesanPengingat(contoh, contoh.namaKos, hariIni, "[link invoice]")
    : pesanReminder(contoh, contoh.namaKos, "[link invoice]");

  const dilewati = kamar.length
    ? kamar.filter((k) => !preview.penerima.some((p) => p.nomorKamar === k))
    : [];
  const catatan = kamar.length
    ? dilewati.length
      ? ` Kamar ${dilewati.join(", ")} dilewati: tidak ada tagihan yang belum dibayar atau sudah diingatkan dalam 24 jam.`
      : ""
    : baruDihubungi.length
      ? ` ${baruDihubungi.length} tagihan dilewati karena penyewanya sudah dihubungi dalam 24 jam terakhir.`
      : "";
  const untuk = kamar.length
    ? `kamar ${[...new Set(preview.penerima.map((p) => p.nomorKamar))].join(", ")}`
    : `${preview.penerima.length} penyewa yang menunggak`;
  return {
    teks:
      `Ini preview pengingat untuk ${untuk}, total ${formatRupiah(preview.total)}. ` +
      `Belum ada pesan yang dikirim sampai kamu konfirmasi.${catatan}\n\n` +
      `Contoh pesan ke ${contoh.namaPenghuni} (${contoh.nomorKamar}):\n${isiContoh}`,
    lampiran: { jenis: "preview_aksi", ...preview },
  };
}
