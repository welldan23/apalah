import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { eq } from "drizzle-orm";

import type { Db } from "../../db/index.ts";
import * as schema from "../../db/schema.ts";
import { isiDataContoh } from "../../db/seed.ts";
import { buatDbUji } from "../../db/testing.ts";
import { getRingkasanTiket, getTiketKos, getTiketPenyewa } from "../data/tiket.ts";
import type { PengirimWhatsApp, PesanWhatsApp } from "../whatsapp/index.ts";
import { GalatAksi } from "./galat.ts";
import {
  bacaInputStatusTiket,
  bacaInputTiket,
  buatTiket,
  kirimKabarTiket,
  MAKS_TIKET_BARU,
  ubahStatusTiket,
} from "./tiket.ts";

const ORG = "org_kos_melati";
// Data contoh: TKT-0014 B06 baru, TKT-0013 C09 baru, TKT-0012 A05 diproses, TKT-0010 A10 diproses, TKT-0007 A05 selesai.
const TOKEN_A05 = "demo-a05-2026-09";

const gagalDengan = (aksi: Promise<unknown>, status: number, pesan?: RegExp) =>
  assert.rejects(aksi, (err) => err instanceof GalatAksi && err.status === status && (!pesan || pesan.test(err.message)));

describe("tiket keluhan penyewa & owner", () => {
  let db: Db;
  let tutup: () => Promise<void>;

  beforeEach(async () => {
    ({ db, tutup } = await buatDbUji());
    await isiDataContoh(db);
  });
  afterEach(() => tutup());

  describe("penyewa (lewat token invoice)", () => {
    it("melihat hanya tiket miliknya: yang berjalan di atas, lalu yang selesai", async () => {
      const data = await getTiketPenyewa(db, TOKEN_A05);
      assert.deepEqual([data?.namaKos, data?.namaPenghuni, data?.nomorKamar], ["Kos Melati", "Rizky Ramadhan", "A05"]);
      assert.deepEqual(data?.tiket.map((t) => [t.nomor, t.status]), [["TKT-0012", "diproses"], ["TKT-0007", "selesai"]]);
      assert.equal(await getTiketPenyewa(db, "demo-z99-2026-09"), null);
      assert.equal(await getTiketPenyewa(db, "' or 1=1 --"), null);
    });

    it("membuat tiket: nomor urut per kos, kamar penyewa sekarang, status Baru", async () => {
      const tiket = await buatTiket(db, TOKEN_A05, { kategori: "perbaikan", deskripsi: "Lampu kamar mandi mati sejak tadi pagi." });
      assert.deepEqual([tiket.nomor, tiket.kategori, tiket.status], ["TKT-0015", "perbaikan", "baru"]);
      const [baris] = await db.select().from(schema.tickets).where(eq(schema.tickets.id, tiket.id));
      assert.deepEqual([baris.organizationId, baris.tenantId, baris.roomId], [ORG, "tnt_A05", "room_A05"]);
      assert.equal((await getTiketPenyewa(db, TOKEN_A05))?.tiket[0].id, tiket.id);

      // Dua tiket bersamaan tetap dapat nomor berbeda.
      const [a, b] = await Promise.all([
        buatTiket(db, "demo-a10-2026-09", { kategori: "kebersihan", deskripsi: "Sampah di lorong lantai dua belum diangkut." }),
        buatTiket(db, "demo-b06-2026-09", { kategori: "lainnya", deskripsi: "Mohon info jadwal pemadaman listrik." }),
      ]);
      assert.deepEqual([a.nomor, b.nomor].sort(), ["TKT-0016", "TKT-0017"]);
    });

    it("validasi input: jenis masalah & panjang cerita", () => {
      assert.deepEqual(bacaInputTiket({ kategori: "air_listrik", deskripsi: "  Air kamar mandi mati.  " }), {
        kategori: "air_listrik",
        deskripsi: "Air kamar mandi mati.",
      });
      for (const [body, pesan] of [
        [{ kategori: "listrik", deskripsi: "Air kamar mandi mati." }, /jenis masalah/],
        [{ kategori: "perbaikan", deskripsi: "Rusak" }, /minimal 10 karakter/],
        [{ kategori: "perbaikan", deskripsi: "x".repeat(1001) }, /Maksimal 1000/],
        [{}, /jenis masalah/],
      ] as const) {
        assert.throws(() => bacaInputTiket(body), (err) => err instanceof GalatAksi && err.status === 400 && pesan.test(err.message));
      }
    });

    it("ditolak: token tak dikenal, penyewa yang sudah keluar, dan terlalu banyak tiket Baru", async () => {
      const input = { kategori: "perbaikan" as const, deskripsi: "Engsel lemari lepas satu." };
      await gagalDengan(buatTiket(db, "demo-z99-2026-09", input), 404);

      await db
        .update(schema.tenants)
        .set({ status: "keluar", tanggalKeluar: "2026-09-24" })
        .where(eq(schema.tenants.id, "tnt_A10"));
      await gagalDengan(buatTiket(db, "demo-a10-2026-09", input), 409, /tidak tercatat menghuni/);

      // B06 sudah punya 1 tiket Baru dari data contoh.
      for (let i = 1; i < MAKS_TIKET_BARU; i++) await buatTiket(db, "demo-b06-2026-09", input);
      await gagalDengan(buatTiket(db, "demo-b06-2026-09", input), 409, /belum ditangani/);
    });
  });

  describe("owner/admin", () => {
    it("daftar semua tiket kos + ringkasan per status; kos lain tidak ikut", async () => {
      const tiket = await getTiketKos(db, ORG);
      assert.deepEqual(
        tiket.map((t) => `${t.nomor} ${t.nomorKamar} ${t.status}`),
        ["TKT-0014 B06 baru", "TKT-0013 C09 baru", "TKT-0012 A05 diproses", "TKT-0010 A10 diproses", "TKT-0007 A05 selesai"],
      );
      assert.deepEqual([tiket[0].namaPenghuni, tiket[0].nomorWa.slice(0, 2)], ["Reza Kurniawan", "62"]);
      assert.deepEqual(await getRingkasanTiket(db, ORG), { baru: 2, diproses: 2, selesai: 1 });
      assert.deepEqual(await getTiketKos(db, "org_griya_asri"), []);
      assert.deepEqual(await getRingkasanTiket(db, "org_griya_asri"), { baru: 0, diproses: 0, selesai: 0 });
    });

    it("status maju satu langkah Baru → Diproses → Selesai; lompat/mundur/kos lain ditolak", async () => {
      const diproses = await ubahStatusTiket(db, ORG, "tkt_b06_1", "diproses");
      assert.equal(diproses.status, "diproses");
      assert.notEqual(diproses.diperbaruiPada, diproses.dibuatPada);
      assert.equal((await ubahStatusTiket(db, ORG, "tkt_b06_1", "selesai")).status, "selesai");

      await gagalDengan(ubahStatusTiket(db, ORG, "tkt_c09_1", "selesai"), 409);
      await gagalDengan(ubahStatusTiket(db, ORG, "tkt_a05_2", "selesai"), 409);
      await gagalDengan(ubahStatusTiket(db, "org_griya_asri", "tkt_c09_1", "diproses"), 404);
      await gagalDengan(ubahStatusTiket(db, ORG, "tkt_tidak_ada", "diproses"), 404);
      assert.equal(bacaInputStatusTiket({ status: "selesai" }), "selesai");
      for (const status of ["baru", "batal", undefined]) {
        assert.throws(() => bacaInputStatusTiket({ status }), (err) => err instanceof GalatAksi && err.status === 400);
      }
    });

    it("dua admin menekan bersamaan → hanya satu yang tersimpan, yang lain 409", async () => {
      const hasil = await Promise.allSettled([
        ubahStatusTiket(db, ORG, "tkt_c09_1", "diproses"),
        ubahStatusTiket(db, ORG, "tkt_c09_1", "diproses"),
      ]);
      assert.equal(hasil.filter((h) => h.status === "fulfilled").length, 1);
    });

    it("penyewa dikabari lewat WhatsApp (template + link status tiket), tercatat di log", async () => {
      const terkirim: PesanWhatsApp[] = [];
      const wa: PengirimWhatsApp = {
        provider: "uji",
        simulasi: false,
        async kirim(p) {
          terkirim.push(p);
          return { ok: true };
        },
      };
      const opsi = { wa, baseUrl: "https://kostera.id" };
      // Tiket yang masih Baru tidak dikabari.
      assert.equal(await kirimKabarTiket(db, "tkt_b06_1", opsi), false);

      await ubahStatusTiket(db, ORG, "tkt_b06_1", "diproses");
      assert.equal(await kirimKabarTiket(db, "tkt_b06_1", opsi), true);
      const [pesan] = terkirim;
      assert.equal(
        pesan.teks,
        "Halo Reza, tiket TKT-0014 (keamanan & kenyamanan) untuk kamar B06 di Kos Melati sekarang sedang ditangani. Detailnya ada di link berikut.\nhttps://kostera.id/invoice/demo-b06-2026-09/tiket/status",
      );
      assert.deepEqual([pesan.template?.nama, pesan.template?.tombolUrl], ["kostera_tiket_diperbarui", "demo-b06-2026-09/tiket/status"]);
      const [log] = await db.select().from(schema.whatsappLogs).where(eq(schema.whatsappLogs.referensiId, "tkt_b06_1"));
      assert.deepEqual([log.jenis, log.organizationId, log.status], ["tiket", ORG, "terkirim"]);
    });
  });
});
