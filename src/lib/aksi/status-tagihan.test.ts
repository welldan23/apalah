import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { and, eq, inArray, lt } from "drizzle-orm";

import type { Db } from "../../db/index.ts";
import * as schema from "../../db/schema.ts";
import { isiDataContoh } from "../../db/seed.ts";
import { buatDbUji } from "../../db/testing.ts";
import { tandaiJatuhTempo } from "../penjadwal/jatuh-tempo.ts";
import type { PengirimWhatsApp, PesanWhatsApp } from "../whatsapp/index.ts";
import { GalatAksi } from "./galat.ts";
import { bacaInputUbahStatus, kirimTagihan, ubahStatusTagihan } from "./status-tagihan.ts";

const ORG = "org_kos_melati";
const HARI_INI = "2026-09-24";

const gagalDengan = (aksi: Promise<unknown>, status: number) =>
  assert.rejects(aksi, (err) => err instanceof GalatAksi && err.status === status);

describe("kirim tagihan & ubah status", () => {
  let db: Db;
  let tutup: () => Promise<void>;

  const statusDari = async (id: string) =>
    (await db.select({ s: schema.invoices.status }).from(schema.invoices).where(eq(schema.invoices.id, id)))[0].s;

  const tambahDraft = (id: string, kamar: string, periode: string, jatuhTempo: string) =>
    db.insert(schema.invoices).values({
      id,
      organizationId: ORG,
      tenantId: `tnt_${kamar}`,
      roomId: `room_${kamar}`,
      periode,
      nominal: 500_000,
      jatuhTempo,
      status: "draft",
      tokenPublik: `uji-${id}`,
    });

  before(async () => {
    ({ db, tutup } = await buatDbUji());
    await isiDataContoh(db);
    await tambahDraft("inv_draft_A01", "A01", "2026-10", "2026-10-03");
    await tambahDraft("inv_draft_A02", "A02", "2026-10", "2026-10-05");
  });
  after(() => tutup());

  describe("kirimTagihan", () => {
    const terkirim: PesanWhatsApp[] = [];
    const wa: PengirimWhatsApp = {
      provider: "uji",
      simulasi: false,
      async kirim(pesan) {
        terkirim.push(pesan);
        // Nomor penghuni A06 sengaja dibuat gagal.
        return pesan.teks.includes("kamar A06") ? { ok: false, galat: "nomor tidak aktif" } : { ok: true };
      },
    };
    const opsi = { baseUrl: "https://kostera.id", hariIni: HARI_INI };

    it("mengirim link invoice, mencatat riwayat, dan mengaktifkan draft yang terkirim", async () => {
      const ids = ["inv_2026-09_A03", "inv_2026-09_A06", "inv_draft_A01"];
      const hasil = await kirimTagihan(db, ORG, { invoiceIds: ids }, wa, opsi);
      assert.deepEqual(hasil, { terkirim: 2, gagal: ["A06"], simulasi: false });

      const a03 = terkirim.find((p) => p.teks.includes("kamar A03"))!;
      assert.match(a03.teks, /^Halo Yoga, ini tagihan sewa kamar A03 di Kos Melati periode September 2026/);
      assert.match(a03.teks, /https:\/\/kostera\.id\/invoice\/demo-a03-2026-09$/);

      const riwayat = await db.select().from(schema.reminders).where(inArray(schema.reminders.invoiceId, ids));
      assert.equal(riwayat.length, 3);
      assert.ok(riwayat.every((r) => r.jenis === "tagihan"));
      assert.equal(riwayat.find((r) => r.invoiceId === "inv_2026-09_A06")?.status, "gagal");

      assert.equal(await statusDari("inv_draft_A01"), "menunggu");
      assert.equal(await statusDari("inv_2026-09_A03"), "menunggu");
    });

    it("menolak tagihan lunas, jatuh tempo, perlu review, dan milik kos lain", async () => {
      for (const id of ["inv_2026-09_A01", "inv_2026-09_A05", "inv_2026-09_C09"]) {
        await gagalDengan(kirimTagihan(db, ORG, { invoiceIds: [id] }, wa, opsi), 409);
      }
      await gagalDengan(kirimTagihan(db, "org_lain", { invoiceIds: ["inv_2026-09_A03"] }, wa, opsi), 404);
    });
  });

  describe("ubahStatusTagihan", () => {
    it("draft diaktifkan menjadi menunggu", async () => {
      const hasil = await ubahStatusTagihan(db, ORG, { invoiceIds: ["inv_draft_A02"], status: "menunggu" }, HARI_INI);
      assert.deepEqual(hasil.diubah, [{ id: "inv_draft_A02", nomorKamar: "A02", status: "menunggu" }]);
      assert.equal(await statusDari("inv_draft_A02"), "menunggu");
    });

    it("perlu review yang sudah diperiksa kembali menunggu — atau jatuh tempo bila tanggalnya lewat", async () => {
      // Jatuh tempo C09: 27 Sep 2026.
      const hasil = await ubahStatusTagihan(db, ORG, { invoiceIds: ["inv_2026-09_C09"], status: "menunggu" }, "2026-09-28");
      assert.equal(hasil.diubah[0].status, "jatuh_tempo");
      assert.equal(await statusDari("inv_2026-09_C09"), "jatuh_tempo");
    });

    it("status lain tidak bisa diubah manual", async () => {
      for (const id of ["inv_2026-09_A01", "inv_2026-09_A03", "inv_2026-09_A05"]) {
        await gagalDengan(ubahStatusTagihan(db, ORG, { invoiceIds: [id], status: "menunggu" }, HARI_INI), 409);
      }
      assert.equal(await statusDari("inv_2026-09_A01"), "lunas");
    });

    it("validasi input: Lunas & status otomatis ditolak dengan alasan", () => {
      assert.deepEqual(bacaInputUbahStatus({ invoiceIds: ["a", "a"], status: "menunggu" }), {
        invoiceIds: ["a"],
        status: "menunggu",
      });
      assert.throws(
        () => bacaInputUbahStatus({ invoiceIds: ["a"], status: "lunas" }),
        /hanya berubah otomatis saat pembayaran terverifikasi/,
      );
      assert.throws(() => bacaInputUbahStatus({ invoiceIds: ["a"], status: "jatuh_tempo" }), GalatAksi);
      assert.throws(() => bacaInputUbahStatus({ invoiceIds: [], status: "menunggu" }), GalatAksi);
    });
  });
});

describe("tandaiJatuhTempo", () => {
  let db: Db;
  let tutup: () => Promise<void>;

  before(async () => {
    ({ db, tutup } = await buatDbUji());
    await isiDataContoh(db);
  });
  after(() => tutup());

  it("tagihan menunggu yang lewat tanggal jatuh tempo menjadi jatuh tempo; aman diulang", async () => {
    const hariIni = "2026-09-28";
    const lewat = await db
      .select({ id: schema.invoices.id })
      .from(schema.invoices)
      .where(and(eq(schema.invoices.status, "menunggu"), lt(schema.invoices.jatuhTempo, hariIni)));
    assert.ok(lewat.length > 0);

    assert.equal(await tandaiJatuhTempo(db, hariIni), lewat.length);
    const status = await db
      .select({ s: schema.invoices.status })
      .from(schema.invoices)
      .where(inArray(schema.invoices.id, lewat.map((l) => l.id)));
    assert.ok(status.every((s) => s.s === "jatuh_tempo"));
    assert.equal(await tandaiJatuhTempo(db, hariIni), 0);
  });

  it("tagihan lunas & perlu review tidak disentuh", async () => {
    await tandaiJatuhTempo(db, "2026-12-31");
    const [a01] = await db.select().from(schema.invoices).where(eq(schema.invoices.id, "inv_2026-09_A01"));
    const [c09] = await db.select().from(schema.invoices).where(eq(schema.invoices.id, "inv_2026-09_C09"));
    assert.equal(a01.status, "lunas");
    assert.equal(c09.status, "perlu_review");
  });
});
