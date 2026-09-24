import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { KATEGORI_TIKET, labelKategori, periksaTiket } from "./tiket.ts";

describe("tiket keluhan penyewa", () => {
  it("kategori tetap & labelnya", () => {
    assert.deepEqual(KATEGORI_TIKET.map((k) => k.id), ["perbaikan", "air_listrik", "kebersihan", "keamanan", "tagihan", "lainnya"]);
    assert.equal(labelKategori("air_listrik"), "Air & listrik");
    assert.equal(labelKategori("asing"), "Lainnya");
  });

  it("validasi kategori & deskripsi (spasi di tepi tidak dihitung)", () => {
    assert.deepEqual(periksaTiket({ kategori: "air_listrik", deskripsi: "Keran kamar mandi bocor sejak kemarin." }), {});
    assert.deepEqual(periksaTiket({ kategori: "", deskripsi: "   bocor   " }), {
      kategori: "Pilih jenis masalahnya.",
      deskripsi: "Ceritakan masalahnya minimal 10 karakter.",
    });
    assert.deepEqual(periksaTiket({ kategori: "lainnya", deskripsi: "x".repeat(1001) }), { deskripsi: "Maksimal 1000 karakter." });
  });
});
