import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { eq } from "drizzle-orm";

import type { Db } from "../../db/index.ts";
import * as schema from "../../db/schema.ts";
import { isiDataContoh } from "../../db/seed.ts";
import { buatDbUji } from "../../db/testing.ts";
import { toolKamarKosong, toolRekapPemasukan, toolTunggakan } from "./tool-baca.ts";

const ORG = "org_kos_melati";
const HARI_INI = "2026-09-24";

describe("tool baca Kosta", () => {
  let db: Db;
  let tutup: () => Promise<void>;

  before(async () => {
    ({ db, tutup } = await buatDbUji());
    await isiDataContoh(db);
  });
  after(() => tutup());

  it("rekap pemasukan bulan berjalan dari pembayaran terverifikasi", async () => {
    assert.deepEqual(await toolRekapPemasukan(db, ORG, { hariIni: HARI_INI }), {
      teks: "Ini rekap pemasukan bulan berjalan, dihitung dari pembayaran yang sudah terverifikasi.",
      lampiran: {
        jenis: "rekap",
        judul: "Pemasukan September 2026",
        baris: [
          { label: "Sudah masuk", nominal: 12_500_000, catatan: "19 pembayaran" },
          { label: "Menunggu", nominal: 6_850_000, catatan: "11 tagihan" },
          { label: "Jatuh tempo", nominal: 1_950_000, catatan: "3 tagihan" },
          { label: "Perlu review", nominal: 800_000, catatan: "1 tagihan · nominal bayar belum cocok" },
        ],
      },
    });
  });

  it("rekap periode tanpa data dan kos lain", async () => {
    assert.deepEqual(await toolRekapPemasukan(db, ORG, { periode: "2026-10", hariIni: HARI_INI }), {
      teks: "Belum ada tagihan maupun pembayaran untuk Oktober 2026.",
    });
    assert.equal((await toolRekapPemasukan(db, "org_kos_mawar", { hariIni: HARI_INI })).lampiran, undefined);
  });

  it("tunggakan: paling lama telat di atas, lengkap dengan total", async () => {
    const hasil = await toolTunggakan(db, ORG, { hariIni: HARI_INI });
    assert.equal(hasil.teks, "Ada 3 tagihan yang sudah lewat jatuh tempo, total Rp1.950.000.");
    assert.deepEqual(hasil.lampiran, {
      jenis: "daftar_tagihan",
      judul: "Tunggakan per 24 Sep 2026",
      baris: [
        { nomorKamar: "A05", nama: "Rizky Ramadhan", nominal: 500_000, keterangan: "lewat 9 hari" },
        { nomorKamar: "B06", nama: "Reza Kurniawan", nominal: 650_000, keterangan: "lewat 6 hari" },
        { nomorKamar: "C05", nama: "Nadia Safitri", nominal: 800_000, keterangan: "lewat 4 hari" },
      ],
      total: 1_950_000,
    });
  });

  it("tunggakan bulan lalu tetap muncul (dengan label periode); periode tanpa tunggakan", async () => {
    await db.update(schema.invoices).set({ periode: "2026-08", jatuhTempo: "2026-08-15" }).where(eq(schema.invoices.id, "inv_2026-09_A05"));
    const semua = await toolTunggakan(db, ORG, { hariIni: HARI_INI });
    assert.deepEqual(semua.lampiran?.jenis === "daftar_tagihan" && semua.lampiran.baris[0], {
      nomorKamar: "A05",
      nama: "Rizky Ramadhan",
      nominal: 500_000,
      keterangan: "lewat 40 hari · Agustus 2026",
    });
    const sep = await toolTunggakan(db, ORG, { periode: "2026-09", hariIni: HARI_INI });
    assert.equal(sep.teks, "Ada 2 tagihan yang sudah lewat jatuh tempo untuk September 2026, total Rp1.450.000.");
    assert.deepEqual(await toolTunggakan(db, ORG, { periode: "2026-07", hariIni: HARI_INI }), {
      teks: "Tidak ada tunggakan untuk Juli 2026. Semua tagihan yang lewat jatuh tempo sudah dibayar.",
    });
  });

  it("tidak membaca kos lain", async () => {
    assert.equal((await toolTunggakan(db, "org_kos_mawar", { hariIni: HARI_INI })).lampiran, undefined);
  });

  it("kamar kosong per tipe, potensi sewa, dan lama kosong", async () => {
    const hasil = await toolKamarKosong(db, ORG, { hariIni: HARI_INI });
    assert.equal(
      hasil.teks,
      "6 kamar masih kosong: A07, A11 (Standar), B05, B13 (KM Dalam), C03, C10 (AC). Potensi sewa Rp3.900.000/bulan.",
    );
    assert.ok(hasil.lampiran?.jenis === "rekap");
    assert.deepEqual(hasil.lampiran.baris.slice(0, 2), [
      { label: "A07 · Standar", nominal: 500_000, catatan: "kosong 86 hari" },
      { label: "A11 · Standar", nominal: 500_000, catatan: "belum ada riwayat penghuni" },
    ]);
    assert.match((await toolKamarKosong(db, "org_kos_mawar", { hariIni: HARI_INI })).teks, /^Belum ada kamar yang terdaftar/);
    await db.update(schema.rooms).set({ status: "terisi" }).where(eq(schema.rooms.organizationId, ORG));
    assert.deepEqual(await toolKamarKosong(db, ORG, { hariIni: HARI_INI }), {
      teks: "Semua kamar sudah terisi. Tidak ada kamar kosong saat ini.",
    });
  });
});
