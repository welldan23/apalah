import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { and, eq } from "drizzle-orm";

import type { Db } from "../../db/index.ts";
import * as schema from "../../db/schema.ts";
import { isiDataContoh } from "../../db/seed.ts";
import { buatDbUji } from "../../db/testing.ts";
import type { PengirimWhatsApp, PesanWhatsApp } from "../whatsapp/index.ts";
import { GalatAksi } from "./galat.ts";
import { bacaInputTambahPenghuni, tambahPenghuni } from "./penghuni.ts";
import { kirimReminder } from "./reminder.ts";
import { bacaInputBuatTagihan, buatTagihan } from "./tagihan.ts";

const ORG = "org_kos_melati";

/** Pastikan aksi gagal dengan GalatAksi berstatus tertentu. */
const gagalDengan = (aksi: Promise<unknown>, status: number) =>
  assert.rejects(aksi, (err) => err instanceof GalatAksi && err.status === status);

describe("aksi cepat dashboard", () => {
  let db: Db;
  let tutup: () => Promise<void>;

  before(async () => {
    ({ db, tutup } = await buatDbUji());
    await isiDataContoh(db);
    await db.insert(schema.users).values({ id: "usr_lain", nama: "Owner Lain", nomorWa: "6280000000001" });
    await db.insert(schema.organizations).values({
      id: "org_lain",
      namaKos: "Kos Lain",
      jumlahKamar: 1,
      ownerId: "usr_lain",
    });
    await db.insert(schema.rooms).values({
      id: "room_lain",
      organizationId: "org_lain",
      nomorKamar: "Z01",
      tipe: "Standar",
      hargaSewa: 400_000,
      status: "kosong",
    });
  });
  after(() => tutup());

  describe("buat tagihan", () => {
    it("membuat tagihan sesuai harga sewa penghuni, lengkap token publik acak", async () => {
      const hasil = await buatTagihan(db, ORG, {
        periode: "2026-10",
        jatuhTempo: "2026-10-10",
        roomIds: ["room_A01", "room_B01", "room_C01"],
      });
      assert.deepEqual(hasil, { dibuat: 3, totalNominal: 1_950_000, dilewati: [] });

      const baru = await db
        .select()
        .from(schema.invoices)
        .where(eq(schema.invoices.periode, "2026-10"));
      assert.equal(baru.length, 3);
      assert.ok(baru.every((inv) => inv.status === "menunggu" && inv.tokenPublik.length >= 24));
      assert.equal(new Set(baru.map((inv) => inv.tokenPublik)).size, 3);

      const rincian = await db
        .select({ label: schema.invoiceItems.label, nominal: schema.invoiceItems.nominal })
        .from(schema.invoiceItems)
        .where(eq(schema.invoiceItems.invoiceId, baru.find((inv) => inv.roomId === "room_C01")!.id));
      assert.deepEqual(rincian, [{ label: "Sewa kamar", nominal: 800_000 }]);
    });

    it("biaya tambahan masuk ke nominal dan rincian setiap tagihan", async () => {
      const hasil = await buatTagihan(db, ORG, {
        periode: "2026-12",
        jatuhTempo: "2026-12-10",
        roomIds: ["room_A01", "room_C01"],
        biayaTambahan: [
          { label: "Listrik", nominal: 75_000 },
          { label: "Air", nominal: 25_000 },
        ],
      });
      assert.deepEqual(hasil, { dibuat: 2, totalNominal: 1_500_000, dilewati: [] });

      const baris = await db
        .select({
          kamar: schema.invoices.roomId,
          nominal: schema.invoices.nominal,
          label: schema.invoiceItems.label,
          rincian: schema.invoiceItems.nominal,
        })
        .from(schema.invoices)
        .innerJoin(schema.invoiceItems, eq(schema.invoiceItems.invoiceId, schema.invoices.id))
        .where(and(eq(schema.invoices.periode, "2026-12"), eq(schema.invoices.roomId, "room_C01")));
      assert.deepEqual(
        baris.map((b) => [b.nominal, b.label, b.rincian]).sort(),
        [
          [900_000, "Air", 25_000],
          [900_000, "Listrik", 75_000],
          [900_000, "Sewa kamar", 800_000],
        ],
      );
    });

    it("kamar yang sudah punya tagihan periode itu dilewati (aman terkirim dua kali)", async () => {
      const hasil = await buatTagihan(db, ORG, {
        periode: "2026-10",
        jatuhTempo: "2026-10-10",
        roomIds: ["room_A01", "room_A02"],
        nominalKhusus: 600_000,
      });
      assert.deepEqual(hasil, { dibuat: 1, totalNominal: 600_000, dilewati: ["A01"] });
    });

    it("menolak kamar kosong atau milik kos lain", async () => {
      const input = { periode: "2026-11", jatuhTempo: "2026-11-10" };
      await gagalDengan(buatTagihan(db, ORG, { ...input, roomIds: ["room_A07"] }), 404);
      await gagalDengan(buatTagihan(db, ORG, { ...input, roomIds: ["room_lain"] }), 404);
    });

    it("validasi input", () => {
      const benar = { periode: "2026-10", jatuhTempo: "2026-10-10", roomIds: ["room_A01"] };
      assert.deepEqual(bacaInputBuatTagihan({ ...benar, roomIds: ["room_A01", "room_A01"] }), {
        ...benar,
        nominalKhusus: undefined,
        biayaTambahan: [],
      });
      assert.deepEqual(
        bacaInputBuatTagihan({ ...benar, biayaTambahan: [{ label: "  Listrik ", nominal: 50_000 }] }).biayaTambahan,
        [{ label: "Listrik", nominal: 50_000 }],
      );
      const biaya = (biayaTambahan: unknown) => () => bacaInputBuatTagihan({ ...benar, biayaTambahan });
      assert.throws(biaya("Listrik"), GalatAksi);
      assert.throws(biaya([{ label: " ", nominal: 50_000 }]), GalatAksi);
      assert.throws(biaya([{ label: "Listrik", nominal: 0 }]), GalatAksi);
      assert.throws(biaya([null]), GalatAksi);
      assert.throws(biaya(Array.from({ length: 11 }, () => ({ label: "Iuran", nominal: 1_000 }))), GalatAksi);
      assert.throws(biaya(Array.from({ length: 3 }, () => ({ label: "Denda", nominal: 900_000_000 }))), GalatAksi);
      assert.throws(() => bacaInputBuatTagihan({ ...benar, periode: "2026-13" }), GalatAksi);
      assert.throws(() => bacaInputBuatTagihan({ ...benar, jatuhTempo: "2026-02-30" }), GalatAksi);
      assert.throws(() => bacaInputBuatTagihan({ ...benar, roomIds: [] }), GalatAksi);
      assert.throws(() => bacaInputBuatTagihan({ ...benar, nominalKhusus: -5 }), GalatAksi);
      assert.throws(() => bacaInputBuatTagihan({ ...benar, nominalKhusus: 1.5 }), GalatAksi);
    });
  });

  describe("tambah penghuni", () => {
    const input = {
      nama: "Budi Santoso",
      nomorWa: "6281299998888",
      roomId: "room_A07",
      tanggalMasuk: "2026-09-25",
      hargaSewa: 550_000,
    };

    it("mencatat penghuni dan kamar jadi terisi", async () => {
      const hasil = await tambahPenghuni(db, ORG, input);
      assert.equal(hasil.nomorKamar, "A07");
      const [kamar] = await db.select().from(schema.rooms).where(eq(schema.rooms.id, "room_A07"));
      assert.equal(kamar.status, "terisi");
      const [penghuni] = await db
        .select()
        .from(schema.tenants)
        .where(and(eq(schema.tenants.roomId, "room_A07"), eq(schema.tenants.status, "aktif")));
      assert.equal(penghuni.nama, "Budi Santoso");
      assert.equal(penghuni.hargaSewa, 550_000);
    });

    it("menolak kamar yang sudah terisi (409) dan kamar kos lain (404)", async () => {
      await gagalDengan(tambahPenghuni(db, ORG, { ...input, roomId: "room_A07" }), 409);
      await gagalDengan(tambahPenghuni(db, ORG, { ...input, roomId: "room_lain" }), 404);
    });

    it("validasi & normalisasi nomor WhatsApp", () => {
      const body = { ...input, nama: "  Sari  ", nomorWa: "0812-3456 7890" };
      const hasil = bacaInputTambahPenghuni(body);
      assert.equal(hasil.nama, "Sari");
      assert.equal(hasil.nomorWa, "6281234567890");
      assert.throws(() => bacaInputTambahPenghuni({ ...body, nomorWa: "12345" }), GalatAksi);
      assert.throws(() => bacaInputTambahPenghuni({ ...body, nama: "   " }), GalatAksi);
      assert.throws(() => bacaInputTambahPenghuni({ ...body, hargaSewa: 0 }), GalatAksi);
    });
  });

  describe("kirim reminder", () => {
    const terkirim: PesanWhatsApp[] = [];
    const wa: PengirimWhatsApp = {
      provider: "uji",
      simulasi: false,
      async kirim(pesan) {
        terkirim.push(pesan);
        // Nomor Reza (B06) sengaja dibuat gagal.
        return pesan.teks.includes("kamar B06") ? { ok: false, galat: "nomor tidak aktif" } : { ok: true };
      },
    };
    const opsi = { baseUrl: "https://kostera.id" };

    it("mengirim pesan berisi nominal & link invoice, lalu mencatat riwayat", async () => {
      const ids = ["inv_2026-09_A05", "inv_2026-09_B06", "inv_2026-09_C05"];
      const hasil = await kirimReminder(db, ORG, { invoiceIds: ids }, wa, opsi);
      assert.deepEqual(hasil, { terkirim: 2, gagal: ["B06"], simulasi: false });

      const a05 = terkirim.find((p) => p.teks.includes("kamar A05"));
      assert.match(a05!.teks, /Halo Rizky, ini pengingat dari Kos Melati/);
      assert.match(a05!.teks, /Rp500\.000/);
      assert.match(a05!.teks, /https:\/\/kostera\.id\/invoice\/demo-a05-2026-09/);

      const riwayat = await db.select().from(schema.reminders).where(eq(schema.reminders.jenis, "manual"));
      assert.equal(riwayat.length, 3);
      assert.deepEqual(
        riwayat.map((r) => r.status).sort(),
        ["gagal", "terkirim", "terkirim"],
      );
      assert.ok(riwayat.every((r) => r.jenis === "manual" && r.organizationId === ORG));
    });

    it("hanya tagihan jatuh tempo milik kos ini yang bisa diingatkan", async () => {
      await gagalDengan(kirimReminder(db, ORG, { invoiceIds: ["inv_2026-09_A03"] }, wa, opsi), 409);
      await gagalDengan(kirimReminder(db, "org_lain", { invoiceIds: ["inv_2026-09_A05"] }, wa, opsi), 404);
    });
  });
});
