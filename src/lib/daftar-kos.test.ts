import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { periksaDataKos } from "./daftar-kos.ts";

describe("data kos pertama", () => {
  it("valid → tanpa galat (spasi di tepi diabaikan)", () => {
    assert.deepEqual(periksaDataKos({ namaPemilik: " Ratna ", namaKos: " Kos Melati ", jumlahKamar: 40 }), {});
  });

  it("galat per kolom", () => {
    assert.deepEqual(periksaDataKos({ namaPemilik: "  ", namaKos: "K", jumlahKamar: 0 }), {
      namaPemilik: "Isi nama kamu.",
      namaKos: "Nama kos 2–80 karakter.",
      jumlahKamar: "Jumlah kamar 1–500.",
    });
    assert.deepEqual(periksaDataKos({ namaPemilik: "x".repeat(61), namaKos: "Kos", jumlahKamar: 2.5 }), {
      namaPemilik: "Nama maksimal 60 karakter.",
      jumlahKamar: "Jumlah kamar 1–500.",
    });
    assert.deepEqual(Object.keys(periksaDataKos({ namaPemilik: "A", namaKos: "Kos", jumlahKamar: 501 })), ["jumlahKamar"]);
    assert.deepEqual(Object.keys(periksaDataKos({ namaPemilik: "A", namaKos: "Kos", jumlahKamar: Number.NaN })), ["jumlahKamar"]);
  });
});
