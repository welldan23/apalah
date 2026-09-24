import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buatDaftarKamar, periksaRencana } from "./rencana-kamar.ts";

const nomor = (daftar: { nomorKamar: string }[]) => daftar.map((k) => k.nomorKamar);

describe("buatDaftarKamar", () => {
  it("kos baru: nomor mulai dari 01 per kode", () => {
    const hasil = buatDaftarKamar([
      { tipe: "Standar", kode: "a", jumlah: 3, hargaSewa: 500_000 },
      { tipe: "AC", kode: "C", jumlah: 2, hargaSewa: 800_000 },
    ]);
    assert.deepEqual(nomor(hasil), ["A01", "A02", "A03", "C01", "C02"]);
    assert.deepEqual(hasil[3], { nomorKamar: "C01", tipe: "AC", hargaSewa: 800_000 });
  });

  it("melanjutkan nomor terbesar yang sudah ada", () => {
    const ada = Array.from({ length: 12 }, (_, i) => `A${String(i + 1).padStart(2, "0")}`);
    const hasil = buatDaftarKamar([{ tipe: "Standar", kode: "A", jumlah: 2, hargaSewa: 500_000 }], ada);
    assert.deepEqual(nomor(hasil), ["A13", "A14"]);
  });

  it("dua baris dengan kode sama tidak bentrok", () => {
    const hasil = buatDaftarKamar([
      { tipe: "Standar", kode: "A", jumlah: 2, hargaSewa: 500_000 },
      { tipe: "Standar Plus", kode: "A", jumlah: 1, hargaSewa: 550_000 },
    ]);
    assert.deepEqual(nomor(hasil), ["A01", "A02", "A03"]);
  });

  it("lebih dari 99 kamar memakai tiga digit", () => {
    const hasil = buatDaftarKamar([{ tipe: "Standar", kode: "A", jumlah: 120, hargaSewa: 500_000 }]);
    assert.equal(hasil[0].nomorKamar, "A001");
    assert.equal(hasil.at(-1)?.nomorKamar, "A120");
  });
});

describe("periksaRencana", () => {
  it("menandai baris yang tidak valid", () => {
    assert.deepEqual(
      periksaRencana([
        { tipe: "Standar", kode: "A", jumlah: 12, hargaSewa: 500_000 },
        { tipe: "", kode: "B", jumlah: 1, hargaSewa: 1 },
        { tipe: "AC", kode: "C1", jumlah: 1, hargaSewa: 1 },
        { tipe: "AC", kode: "C", jumlah: 0, hargaSewa: 1 },
        { tipe: "AC", kode: "C", jumlah: 1, hargaSewa: 0 },
      ]).map((g) => g !== ""),
      [false, true, true, true, true],
    );
  });
});
