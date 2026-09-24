import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { and, eq } from "drizzle-orm";

import type { Db } from "../../db/index.ts";
import * as schema from "../../db/schema.ts";
import { isiDataContoh } from "../../db/seed.ts";
import { buatDbUji } from "../../db/testing.ts";
import type { PengirimWhatsApp, PesanWhatsApp } from "../whatsapp/index.ts";
import { kirimPengingatOtomatis } from "./pengingat-otomatis.ts";

const ORG = "org_kos_melati";
const BASE = "https://kostera.id";
// Jadwal bawaan H-3/H/H+3 jam 09.00. Pada 27 Sep: H-3 → jatuh tempo 30 Sep (A12, C12),
// H → 27 Sep (A10; C09 perlu review tidak ikut), H+3 → 24 Sep (B15).
const MINGGU_0905 = new Date("2026-09-27T09:05:00+07:00");

function buatWa({ gagalUntuk = [] as string[], jeda = 0 } = {}) {
  const terkirim: PesanWhatsApp[] = [];
  const wa: PengirimWhatsApp = {
    provider: "uji",
    simulasi: false,
    async kirim(pesan) {
      if (jeda) await new Promise((r) => setTimeout(r, jeda));
      terkirim.push(pesan);
      return gagalUntuk.some((k) => pesan.teks.includes(`kamar ${k}`)) ? { ok: false, galat: "nomor tidak aktif" } : { ok: true };
    },
  };
  return { wa, terkirim };
}

describe("penjadwal pengingat otomatis", () => {
  let db: Db;
  let tutup: () => Promise<void>;
  /** Log reminders yang dicatat putaran pada `waktu`, "kamar jenis status galat". */
  const logPutaran = async (waktu: Date) =>
    (
      await db
        .select({ invoiceId: schema.reminders.invoiceId, jenis: schema.reminders.jenis, status: schema.reminders.status, galat: schema.reminders.galat })
        .from(schema.reminders)
        .where(eq(schema.reminders.terkirimPada, waktu))
    )
      .map((r) => `${r.invoiceId.slice(-3)} ${r.jenis} ${r.status} ${r.galat}`)
      .sort();
  const kamarDikirimi = (terkirim: PesanWhatsApp[]) => terkirim.map((p) => /kamar (\w+)/.exec(p.teks)![1]).sort();

  beforeEach(async () => {
    ({ db, tutup } = await buatDbUji());
    await isiDataContoh(db);
  });
  afterEach(() => tutup());

  it("mengirim slot yang jatuh waktu dengan isi sesuai waktu, lalu mencatatnya", async () => {
    const { wa, terkirim } = buatWa();
    const hasil = await kirimPengingatOtomatis(db, { wa, baseUrl: BASE, sekarang: MINGGU_0905 });
    assert.deepEqual(hasil, { terkirim: 4, gagal: 0, dilewati: 0, ditunda: false });
    assert.deepEqual(kamarDikirimi(terkirim), ["A10", "A12", "B15", "C12"]);
    const teks = (k: string) => terkirim.find((p) => p.teks.includes(`kamar ${k}`))!.teks;
    assert.match(teks("A12"), /jatuh tempo 30 Sep 2026 \(3 hari lagi\)/);
    assert.match(teks("A10"), /jatuh tempo hari ini/);
    assert.match(teks("B15"), /sudah lewat jatuh tempo \(24 Sep 2026\)/);
    assert.match(teks("B15"), /\nhttps:\/\/kostera\.id\/invoice\/demo-b15-2026-09$/);
    // Template resmi ikut dikirim untuk provider WhatsApp Cloud API.
    assert.deepEqual(
      terkirim.map((p) => p.template?.nama).sort(),
      ["kostera_pengingat_lewat", "kostera_pengingat_sebelum", "kostera_pengingat_sebelum", "kostera_pengingat_sebelum"],
    );
    assert.deepEqual(await logPutaran(MINGGU_0905), [
      "A10 H terkirim null",
      "A12 H-3 terkirim null",
      "B15 H+3 terkirim null",
      "C12 H-3 terkirim null",
    ]);
  });

  it("putaran ulang (termasuk bersamaan) tidak mengirim dobel; yang gagal tercatat & tidak diulang otomatis", async () => {
    const pertama = buatWa({ gagalUntuk: ["C12"], jeda: 5 });
    const [a, b] = await Promise.all([
      kirimPengingatOtomatis(db, { wa: pertama.wa, baseUrl: BASE, sekarang: MINGGU_0905 }),
      kirimPengingatOtomatis(db, { wa: pertama.wa, baseUrl: BASE, sekarang: MINGGU_0905 }),
    ]);
    assert.equal(a.terkirim + b.terkirim, 3);
    assert.equal(a.gagal + b.gagal, 1);
    assert.deepEqual(kamarDikirimi(pertama.terkirim), ["A10", "A12", "B15", "C12"]);

    const ulang = buatWa();
    const sejamLagi = new Date(MINGGU_0905.getTime() + 3_600_000);
    assert.deepEqual(await kirimPengingatOtomatis(db, { wa: ulang.wa, baseUrl: BASE, sekarang: sejamLagi }), {
      terkirim: 0,
      gagal: 0,
      dilewati: 0,
      ditunda: false,
    });
    assert.equal(ulang.terkirim.length, 0);
    assert.ok((await logPutaran(MINGGU_0905)).includes("C12 H-3 gagal nomor tidak aktif"));
  });

  it("di luar jam 06.00–21.00 ditunda; putaran pagi berikutnya menyusulkan slot yang terlewat", async () => {
    const { wa, terkirim } = buatWa();
    const malam = await kirimPengingatOtomatis(db, { wa, baseUrl: BASE, sekarang: new Date("2026-09-27T21:30:00+07:00") });
    assert.deepEqual(malam, { terkirim: 0, gagal: 0, dilewati: 0, ditunda: true });
    // Cron mati seharian; 28 Sep pukul 06.05 slot 27 Sep 09.00 masih dalam 24 jam → dikirim, isinya dihitung ulang.
    const pagi = await kirimPengingatOtomatis(db, { wa, baseUrl: BASE, sekarang: new Date("2026-09-28T06:05:00+07:00") });
    assert.equal(pagi.terkirim, 4);
    assert.match(terkirim.find((p) => p.teks.includes("kamar A10"))!.teks, /sudah lewat jatuh tempo \(27 Sep 2026\)/);
    // Slot lebih dari 24 jam lalu tidak dikirim lagi.
    const lusa = buatWa();
    await kirimPengingatOtomatis(db, { wa: lusa.wa, baseUrl: BASE, sekarang: new Date("2026-09-28T08:59:00+07:00") });
    assert.equal(lusa.terkirim.length, 0);
  });

  it("saklar utama mati atau jadwal nonaktif → tidak ada kiriman untuk jadwal itu", async () => {
    await db.update(schema.reminderSchedules).set({ aktif: false }).where(and(eq(schema.reminderSchedules.organizationId, ORG), eq(schema.reminderSchedules.offsetHari, -3)));
    const sebagian = buatWa();
    await kirimPengingatOtomatis(db, { wa: sebagian.wa, baseUrl: BASE, sekarang: MINGGU_0905 });
    assert.deepEqual(kamarDikirimi(sebagian.terkirim), ["A10", "B15"]);

    await db.update(schema.organizations).set({ pengingatOtomatis: false }).where(eq(schema.organizations.id, ORG));
    await db.update(schema.reminderSchedules).set({ jamKirim: "10:00" }).where(eq(schema.reminderSchedules.organizationId, ORG));
    const mati = buatWa();
    await kirimPengingatOtomatis(db, { wa: mati.wa, baseUrl: BASE, sekarang: new Date("2026-09-28T10:05:00+07:00") });
    assert.equal(mati.terkirim.length, 0);
  });

  it("satu penyewa sekali per 24 jam: yang baru dihubungi dilewati; dua tagihan satu penyewa → satu pesan", async () => {
    // Penyewa A10 diingatkan manual 2 jam sebelumnya.
    await db.insert(schema.reminders).values({
      organizationId: ORG,
      invoiceId: "inv_2026-09_A10",
      tenantId: "tnt_A10",
      jenis: "manual",
      status: "terkirim",
      terkirimPada: new Date(MINGGU_0905.getTime() - 2 * 3_600_000),
    });
    // Penyewa A12 masih punya tunggakan Agustus yang jatuh tempo 27 Sep (slot H yang sama waktunya).
    await db.insert(schema.invoices).values({
      id: "inv_2026-08_A12",
      organizationId: ORG,
      tenantId: "tnt_A12",
      roomId: "room_A12",
      periode: "2026-08",
      nominal: 500_000,
      jatuhTempo: "2026-09-27",
      status: "menunggu",
      tokenPublik: "uji-a12-2026-08",
    });
    const { wa, terkirim } = buatWa();
    const hasil = await kirimPengingatOtomatis(db, { wa, baseUrl: BASE, sekarang: MINGGU_0905 });
    assert.deepEqual(hasil, { terkirim: 3, gagal: 0, dilewati: 2, ditunda: false });
    assert.deepEqual(kamarDikirimi(terkirim), ["A12", "B15", "C12"]);
    // Untuk A12, tagihan dengan jatuh tempo terlama yang diingatkan (periode Agustus).
    assert.match(terkirim.find((p) => p.teks.includes("kamar A12"))!.teks, /periode Agustus 2026/);
  });
});
