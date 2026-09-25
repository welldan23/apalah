// Konfirmasi kirim tagihan ke penyewa dan perubahan status tagihan oleh owner.
// Aturan status (deterministik, bukan dari AI):
// - Lunas & Perlu review hanya dari webhook pembayaran; Jatuh tempo diperbarui otomatis tiap hari.
// - Owner hanya boleh mengaktifkan tagihan Draft atau menandai tagihan Perlu review sudah diperiksa;
//   keduanya kembali Menunggu (atau Jatuh tempo bila tanggalnya sudah lewat).

import { and, eq, inArray } from "drizzle-orm";

import { schema, type Db } from "../../db/index.ts";
import { pesanTagihan, templateTagihan } from "../pesan.ts";
import type { HasilKirim, PengirimWhatsApp } from "../whatsapp/index.ts";
import { kirimDanCatat } from "../whatsapp/log.ts";
import type { InvoiceStatus } from "@/lib/types";
import { GalatAksi } from "./galat.ts";

const { invoices, organizations, reminders, rooms, tenants } = schema;

/** Tagihan yang boleh dikirim: belum dibayar, belum lewat jatuh tempo, dan tidak sedang direview. */
export const STATUS_BISA_DIKIRIM: InvoiceStatus[] = ["draft", "menunggu", "terkirim"];

/** Status aktif sebuah tagihan belum bayar menurut tanggal jatuh temponya. */
export const statusAktif = (jatuhTempo: string, hariIni: string): InvoiceStatus =>
  jatuhTempo < hariIni ? "jatuh_tempo" : "menunggu";

const ALASAN_DITOLAK: Partial<Record<InvoiceStatus, string>> = {
  lunas: "Status Lunas hanya berubah otomatis saat pembayaran terverifikasi payment gateway.",
  perlu_review: "Perlu review ditandai otomatis saat nominal pembayaran tidak cocok.",
  jatuh_tempo: "Jatuh tempo diperbarui otomatis setiap hari sesuai tanggalnya.",
  terkirim: "Gunakan Kirim tagihan untuk mengirim tagihan ke penyewa.",
  draft: "Tagihan yang sudah terbit tidak bisa dikembalikan ke draft.",
};

/** Status dari mana owner boleh mengembalikan tagihan ke Menunggu. */
const BOLEH_DIAKTIFKAN: InvoiceStatus[] = ["draft", "perlu_review"];

function bacaInvoiceIds(invoiceIds: unknown) {
  if (
    !Array.isArray(invoiceIds) ||
    invoiceIds.length === 0 ||
    invoiceIds.length > 500 ||
    !invoiceIds.every((id) => typeof id === "string")
  ) {
    throw new GalatAksi("Pilih minimal satu tagihan.");
  }
  return [...new Set(invoiceIds as string[])];
}

export function bacaInputKirimTagihan(body: Record<string, unknown>) {
  return { invoiceIds: bacaInvoiceIds(body.invoiceIds) };
}

export function bacaInputUbahStatus(body: Record<string, unknown>) {
  const invoiceIds = bacaInvoiceIds(body.invoiceIds);
  const { status } = body;
  if (status !== "menunggu") {
    const alasan = typeof status === "string" ? ALASAN_DITOLAK[status as InvoiceStatus] : undefined;
    throw new GalatAksi(alasan ?? "Status tujuan hanya boleh menunggu.");
  }
  return { invoiceIds, status: "menunggu" as const };
}

async function ambilTagihan(db: Db, organizationId: string, invoiceIds: string[]) {
  const tagihan = await db
    .select({
      id: invoices.id,
      tenantId: invoices.tenantId,
      periode: invoices.periode,
      nominal: invoices.nominal,
      jatuhTempo: invoices.jatuhTempo,
      status: invoices.status,
      tokenPublik: invoices.tokenPublik,
      namaPenghuni: tenants.nama,
      nomorWa: tenants.nomorWa,
      nomorKamar: rooms.nomorKamar,
    })
    .from(invoices)
    .innerJoin(tenants, eq(tenants.id, invoices.tenantId))
    .innerJoin(rooms, eq(rooms.id, invoices.roomId))
    .where(and(eq(invoices.organizationId, organizationId), inArray(invoices.id, invoiceIds)));
  if (tagihan.length !== invoiceIds.length) {
    throw new GalatAksi("Sebagian tagihan tidak ditemukan.", 404);
  }
  return tagihan;
}

/** Tolak bila ada tagihan yang statusnya di luar `boleh`, sebutkan kamarnya. */
function pastikanStatus(
  tagihan: { status: InvoiceStatus; nomorKamar: string }[],
  boleh: InvoiceStatus[],
  pesan: string,
) {
  const ditolak = tagihan.filter((t) => !boleh.includes(t.status));
  if (ditolak.length > 0) {
    throw new GalatAksi(`${pesan} (kamar ${ditolak.map((t) => t.nomorKamar).sort().join(", ")}).`, 409);
  }
}

export type HasilKirimTagihan = {
  terkirim: number;
  /** Nomor kamar yang gagal dikirimi. */
  gagal: string[];
  /** true bila provider WhatsApp masih mode pengembangan (pesan tidak benar-benar terkirim). */
  simulasi: boolean;
};

/**
 * Kirim link invoice ke WhatsApp penyewa (setelah owner mengonfirmasi preview), catat di riwayat
 * kiriman (tabel reminders, jenis "tagihan"), dan aktifkan tagihan Draft yang berhasil terkirim.
 */
export async function kirimTagihan(
  db: Db,
  organizationId: string,
  { invoiceIds }: { invoiceIds: string[] },
  wa: PengirimWhatsApp,
  { baseUrl, hariIni }: { baseUrl: string; hariIni: string },
): Promise<HasilKirimTagihan> {
  const [kos] = await db
    .select({ namaKos: organizations.namaKos })
    .from(organizations)
    .where(eq(organizations.id, organizationId));
  if (!kos) throw new GalatAksi("Kos tidak ditemukan.", 404);

  const tagihan = await ambilTagihan(db, organizationId, invoiceIds);
  pastikanStatus(
    tagihan,
    STATUS_BISA_DIKIRIM,
    "Hanya tagihan yang belum dibayar dan belum lewat jatuh tempo yang bisa dikirim; untuk yang jatuh tempo pakai Kirim reminder",
  );

  // Dikirim satu per satu supaya tidak membanjiri provider WhatsApp.
  const hasil: { t: (typeof tagihan)[number]; kirim: HasilKirim }[] = [];
  for (const t of tagihan) {
    const teks = pesanTagihan(t, kos.namaKos, `${baseUrl}/invoice/${t.tokenPublik}`);
    const template = templateTagihan(t, kos.namaKos, t.tokenPublik);
    const kirim = await kirimDanCatat(db, wa, { ke: t.nomorWa, teks, template }, { jenis: "tagihan", organizationId, referensiId: t.id });
    hasil.push({ t, kirim });
  }

  await db.transaction(async (tx) => {
    await tx.insert(reminders).values(
      hasil.map(({ t, kirim }) => ({
        organizationId,
        invoiceId: t.id,
        tenantId: t.tenantId,
        jenis: "tagihan",
        kanal: "whatsapp",
        status: kirim.ok ? ("terkirim" as const) : ("gagal" as const),
        galat: kirim.ok ? null : kirim.galat,
      })),
    );
    for (const { t } of hasil.filter((h) => h.kirim.ok && h.t.status === "draft")) {
      await tx
        .update(invoices)
        .set({ status: statusAktif(t.jatuhTempo, hariIni) })
        .where(and(eq(invoices.id, t.id), eq(invoices.status, "draft")));
    }
  });

  return {
    terkirim: hasil.filter((h) => h.kirim.ok).length,
    gagal: hasil.filter((h) => !h.kirim.ok).map((h) => h.t.nomorKamar).sort(),
    simulasi: wa.simulasi,
  };
}

/** Aktifkan tagihan Draft / tandai Perlu review sudah diperiksa → Menunggu atau Jatuh tempo. */
export async function ubahStatusTagihan(
  db: Db,
  organizationId: string,
  { invoiceIds }: { invoiceIds: string[]; status: "menunggu" },
  hariIni: string,
) {
  const tagihan = await ambilTagihan(db, organizationId, invoiceIds);
  pastikanStatus(tagihan, BOLEH_DIAKTIFKAN, "Hanya tagihan Draft atau Perlu review yang bisa diubah manual");

  return db.transaction(async (tx) => {
    const hasil: { id: string; nomorKamar: string; status: InvoiceStatus }[] = [];
    for (const t of tagihan) {
      const status = statusAktif(t.jatuhTempo, hariIni);
      await tx
        .update(invoices)
        .set({ status })
        // Syarat status lama mencegah menimpa perubahan dari webhook yang datang bersamaan.
        .where(and(eq(invoices.id, t.id), eq(invoices.status, t.status)));
      hasil.push({ id: t.id, nomorKamar: t.nomorKamar, status });
    }
    return { diubah: hasil };
  });
}
