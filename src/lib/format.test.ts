import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatAngka,
  formatHari,
  formatPeriode,
  formatRupiah,
  formatRupiahSingkat,
  formatTanggal,
  formatTanggalPendek,
  formatWaktu,
  periodeBerikutnya,
  selisihHari,
} from "./format.ts";

describe("formatRupiah", () => {
  it("memakai titik sebagai pemisah ribuan tanpa spasi", () => {
    assert.equal(formatRupiah(12_500_000), "Rp12.500.000");
    assert.equal(formatRupiah(650_000), "Rp650.000");
    assert.equal(formatRupiah(0), "Rp0");
  });

  it("menaruh tanda minus sebelum Rp", () => {
    assert.equal(formatRupiah(-500_000), "-Rp500.000");
  });

  it("formatAngka tanpa awalan Rp", () => {
    assert.equal(formatAngka(1_950_000), "1.950.000");
  });
});

describe("formatRupiahSingkat", () => {
  it("meringkas ke rb / jt / M dengan koma desimal", () => {
    assert.equal(formatRupiahSingkat(12_500_000), "Rp12,5jt");
    assert.equal(formatRupiahSingkat(7_650_000), "Rp7,65jt");
    assert.equal(formatRupiahSingkat(1_950_000), "Rp1,95jt");
    assert.equal(formatRupiahSingkat(800_000), "Rp800rb");
    assert.equal(formatRupiahSingkat(999_500), "Rp1jt");
    assert.equal(formatRupiahSingkat(2_300_000_000), "Rp2,3M");
  });

  it("naik satuan setelah pembulatan", () => {
    assert.equal(formatRupiahSingkat(999_999), "Rp1jt");
    assert.equal(formatRupiahSingkat(999_999_999), "Rp1M");
  });

  it("nominal kecil dan negatif", () => {
    assert.equal(formatRupiahSingkat(500), "Rp500");
    assert.equal(formatRupiahSingkat(0), "Rp0");
    assert.equal(formatRupiahSingkat(-1_950_000), "-Rp1,95jt");
  });
});

describe("tanggal", () => {
  it("tidak bergeser karena zona waktu", () => {
    assert.equal(formatTanggal("2026-09-01"), "1 Sep 2026");
    assert.equal(formatTanggalPendek("2026-09-24"), "24 Sep");
    assert.equal(formatHari("2026-09-24"), "Kamis, 24 September 2026");
    assert.equal(formatPeriode("2026-09"), "September 2026");
  });

  it("formatWaktu memakai WIB", () => {
    assert.equal(formatWaktu("2026-09-20T14:32:00+07:00"), "20 Sep, 14.32");
    assert.equal(formatWaktu("2026-09-20T00:30:00Z"), "20 Sep, 07.30");
  });

  it("selisihHari menghitung hari kalender", () => {
    assert.equal(selisihHari("2026-09-24", "2026-09-15"), -9);
    assert.equal(selisihHari("2026-09-24", "2026-09-24"), 0);
    assert.equal(selisihHari("2026-09-24", "2026-10-01"), 7);
  });

  it("periodeBerikutnya melewati pergantian tahun", () => {
    assert.equal(periodeBerikutnya("2026-09"), "2026-10");
    assert.equal(periodeBerikutnya("2026-12"), "2027-01");
  });
});
