import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { bacaFilterKamarKosong, hariKosong, parseUrutKosong, saringKamarKosong } from "./kamar-kosong.ts";

const kamar = [
  { nomorKamar: "A07", tipe: "Standar", hargaSewa: 500_000, kosongSejak: "2026-06-30" },
  { nomorKamar: "A11", tipe: "Standar", hargaSewa: 500_000 },
  { nomorKamar: "B05", tipe: "KM Dalam", hargaSewa: 650_000, kosongSejak: "2026-08-31" },
  { nomorKamar: "C03", tipe: "AC", hargaSewa: 800_000 },
  { nomorKamar: "A10", tipe: "Standar", hargaSewa: 450_000 },
];
const nomor = (daftar: { nomorKamar: string }[]) => daftar.map((k) => k.nomorKamar);

describe("saringKamarKosong", () => {
  it("urut nomor kamar secara numerik", () => {
    assert.deepEqual(nomor(saringKamarKosong(kamar, { tipe: null, urut: "nomor" })), ["A07", "A10", "A11", "B05", "C03"]);
  });

  it("paling lama kosong di atas; tanpa riwayat di bawah", () => {
    assert.deepEqual(nomor(saringKamarKosong(kamar, { tipe: null, urut: "terlama" })), ["A07", "B05", "A10", "A11", "C03"]);
  });

  it("urut harga, seri diurut nomor", () => {
    assert.deepEqual(nomor(saringKamarKosong(kamar, { tipe: null, urut: "termurah" })), ["A10", "A07", "A11", "B05", "C03"]);
    assert.deepEqual(nomor(saringKamarKosong(kamar, { tipe: null, urut: "termahal" })), ["C03", "B05", "A07", "A11", "A10"]);
  });

  it("saring per tipe tanpa mengubah array asal", () => {
    assert.deepEqual(nomor(saringKamarKosong(kamar, { tipe: "Standar", urut: "nomor" })), ["A07", "A10", "A11"]);
    assert.equal(kamar[0].nomorKamar, "A07");
    assert.equal(kamar.length, 5);
  });
});

describe("parseUrutKosong", () => {
  it("nilai tidak dikenal → nomor", () => {
    assert.equal(parseUrutKosong("terlama"), "terlama");
    assert.equal(parseUrutKosong("acak"), "nomor");
    assert.equal(parseUrutKosong(null), "nomor");
  });
});

describe("hariKosong", () => {
  it("selisih hari sejak keluar; undefined bila tidak diketahui", () => {
    assert.equal(hariKosong("2026-06-30", "2026-09-24"), 86);
    assert.equal(hariKosong("2026-09-24", "2026-09-24"), 0);
    assert.equal(hariKosong(undefined, "2026-09-24"), undefined);
  });
});

describe("filter harga & bacaFilterKamarKosong", () => {
  it("hargaMaks menyaring kamar yang lebih mahal", () => {
    assert.deepEqual(nomor(saringKamarKosong(kamar, { tipe: null, urut: "nomor", hargaMaks: 500_000 })), ["A07", "A10", "A11"]);
  });

  it("membaca & memvalidasi query", () => {
    const baca = (q: string) => bacaFilterKamarKosong(new URLSearchParams(q));
    assert.deepEqual(baca(""), { filter: { tipe: null, urut: "nomor" } });
    assert.deepEqual(baca("tipe=AC&urut=termurah&hargaMaks=800000"), { filter: { tipe: "AC", urut: "termurah", hargaMaks: 800_000 } });
    assert.ok("galat" in baca("urut=acak"));
    assert.ok("galat" in baca("hargaMaks=0"));
    assert.ok("galat" in baca("hargaMaks=5jt"));
  });
});

