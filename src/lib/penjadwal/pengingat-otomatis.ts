// Penjadwal pengingat bayar otomatis — dijalankan tiap jam oleh cron (GET /api/cron/pengingat).
// Aturan:
// - hanya kos yang saklar pengingat otomatisnya menyala, dan hanya jadwal yang aktif;
// - slot jadwal yang waktunya jatuh dalam 24 jam terakhir (putaran telat tetap menyusul);
// - hanya tagihan yang belum dibayar, dan hanya di jam kirim wajar 06.00–21.00 WIB;
// - satu penyewa paling banyak sekali per 24 jam (slot terbaru didahulukan);
// - satu slot per tagihan diklaim dulu di tabel reminders (unique invoice + jenis), jadi dua
//   putaran yang berjalan bersamaan tidak mengirim dobel.

import { and, eq, gt, inArray, like } from "drizzle-orm";

import { schema, type Db } from "../../db/index.ts";
import { GalatAksi } from "../aksi/galat.ts";
import { susunPesanReminder } from "../aksi/pesan-reminder.ts";
import { kontakPenyewa } from "../data/reminder.ts";
import {
  dalamJamKirim,
  GALAT_TERPUTUS,
  JEDA_PENGINGAT_JAM,
  slotPengingatJatuhWaktu,
  STATUS_BISA_DIINGATKAN,
  type JadwalPengingat,
  type SlotPengingat,
} from "../reminder.ts";
import { hariIniWib } from "../waktu.ts";
import type { PengirimWhatsApp } from "../whatsapp/index.ts";
import { kirimDanCatat } from "../whatsapp/log.ts";

const { invoices, organizations, reminderSchedules, reminders } = schema;

export type HasilPengingatOtomatis = {
  terkirim: number;
  gagal: number;
  /** Tidak dikirim karena penyewanya sudah dihubungi dalam 24 jam terakhir. */
  dilewati: number;
  /** true bila putaran ini di luar jam kirim wajar — semua pengingat ditunda. */
  ditunda: boolean;
};

type Kandidat = { organizationId: string; invoiceId: string; tenantId: string; slot: SlotPengingat };

export async function kirimPengingatOtomatis(
  db: Db,
  { wa, baseUrl, sekarang = new Date() }: { wa: PengirimWhatsApp; baseUrl: string; sekarang?: Date },
): Promise<HasilPengingatOtomatis> {
  const hasil: HasilPengingatOtomatis = { terkirim: 0, gagal: 0, dilewati: 0, ditunda: false };
  if (!dalamJamKirim(sekarang)) return { ...hasil, ditunda: true };

  // 1. Jadwal aktif per kos yang pengingat otomatisnya menyala.
  const baris = await db
    .select({ organizationId: reminderSchedules.organizationId, offsetHari: reminderSchedules.offsetHari, jamKirim: reminderSchedules.jamKirim })
    .from(reminderSchedules)
    .innerJoin(organizations, eq(organizations.id, reminderSchedules.organizationId))
    .where(and(eq(organizations.pengingatOtomatis, true), eq(reminderSchedules.aktif, true)));
  const jadwalPerKos = new Map<string, JadwalPengingat[]>();
  for (const b of baris) {
    const daftar = jadwalPerKos.get(b.organizationId) ?? [];
    daftar.push({ offsetHari: b.offsetHari, jam: b.jamKirim.slice(0, 5), aktif: true });
    jadwalPerKos.set(b.organizationId, daftar);
  }

  // 2. Tagihan belum dibayar yang jatuh temponya cocok dengan slot yang jatuh waktu.
  let kandidat: Kandidat[] = [];
  for (const [organizationId, jadwal] of jadwalPerKos) {
    const slot = slotPengingatJatuhWaktu(jadwal, sekarang);
    if (slot.length === 0) continue;
    const tagihan = await db
      .select({ id: invoices.id, tenantId: invoices.tenantId, jatuhTempo: invoices.jatuhTempo })
      .from(invoices)
      .where(
        and(
          eq(invoices.organizationId, organizationId),
          inArray(invoices.jatuhTempo, [...new Set(slot.map((s) => s.jatuhTempo))]),
          inArray(invoices.status, [...STATUS_BISA_DIINGATKAN]),
        ),
      );
    for (const s of slot) {
      for (const t of tagihan.filter((t) => t.jatuhTempo === s.jatuhTempo)) {
        kandidat.push({ organizationId, invoiceId: t.id, tenantId: t.tenantId, slot: s });
      }
    }
  }
  if (kandidat.length === 0) return hasil;

  // 3. Buang slot yang sudah pernah dicatat (terkirim, gagal, atau sedang dikirim putaran lain).
  const sudah = await db
    .select({ invoiceId: reminders.invoiceId, jenis: reminders.jenis })
    .from(reminders)
    .where(and(inArray(reminders.invoiceId, [...new Set(kandidat.map((k) => k.invoiceId))]), like(reminders.jenis, "H%")));
  const kunciSudah = new Set(sudah.map((r) => `${r.invoiceId}|${r.jenis}`));
  kandidat = kandidat.filter((k) => !kunciSudah.has(`${k.invoiceId}|${k.slot.jenis}`));

  // 4. Anti-spam: satu pesan per penyewa per 24 jam; slot terbaru dulu, lalu tunggakan terlama.
  const baruDihubungi = await db
    .selectDistinct({ tenantId: reminders.tenantId })
    .from(reminders)
    .where(
      and(
        inArray(reminders.tenantId, [...new Set(kandidat.map((k) => k.tenantId))]),
        kontakPenyewa(),
        gt(reminders.terkirimPada, new Date(sekarang.getTime() - JEDA_PENGINGAT_JAM * 3_600_000)),
      ),
    );
  const sudahDihubungi = new Set(baruDihubungi.map((r) => r.tenantId));
  kandidat.sort(
    (a, b) => b.slot.waktuKirim.getTime() - a.slot.waktuKirim.getTime() || a.slot.jatuhTempo.localeCompare(b.slot.jatuhTempo),
  );
  const dipilih: Kandidat[] = [];
  for (const k of kandidat) {
    if (sudahDihubungi.has(k.tenantId)) {
      hasil.dilewati += 1;
      continue;
    }
    sudahDihubungi.add(k.tenantId);
    dipilih.push(k);
  }

  // 5. Susun pesan per kos, klaim slot, kirim satu per satu, catat hasilnya.
  const hariIni = hariIniWib(sekarang);
  for (const organizationId of new Set(dipilih.map((k) => k.organizationId))) {
    const milikKos = dipilih.filter((k) => k.organizationId === organizationId);
    let pesan;
    try {
      pesan = await susunPesanReminder(db, organizationId, milikKos.map((k) => k.invoiceId), { baseUrl, hariIni });
    } catch (err) {
      // Mis. tagihan baru saja lunas di antara query — kos ini dicoba lagi putaran berikutnya.
      if (!(err instanceof GalatAksi)) throw err;
      console.warn(`[pengingat-otomatis] ${organizationId}: ${err.message}`);
      continue;
    }
    for (const p of pesan) {
      const { slot } = milikKos.find((k) => k.invoiceId === p.invoiceId)!;
      const [klaim] = await db
        .insert(reminders)
        .values({
          organizationId,
          invoiceId: p.invoiceId,
          tenantId: p.tenantId,
          jenis: slot.jenis,
          kanal: "whatsapp",
          status: "gagal",
          galat: GALAT_TERPUTUS,
          terkirimPada: sekarang,
        })
        .onConflictDoNothing()
        .returning({ id: reminders.id });
      if (!klaim) continue;

      const kirim = await kirimDanCatat(
        db,
        wa,
        { ke: p.nomorWa, teks: p.teks, template: p.template },
        { jenis: "pengingat", organizationId, referensiId: klaim.id },
      );
      await db
        .update(reminders)
        .set({ status: kirim.ok ? "terkirim" : "gagal", galat: kirim.ok ? null : kirim.galat })
        .where(eq(reminders.id, klaim.id));
      if (kirim.ok) hasil.terkirim += 1;
      else hasil.gagal += 1;
    }
  }
  return hasil;
}
