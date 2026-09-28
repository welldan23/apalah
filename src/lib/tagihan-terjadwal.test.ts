import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  jatuhTempoUntuk,
  peringatanJadwal,
  ringkasJadwal,
  terbitBerikutnya,
} from "./tagihan-terjadwal.ts";

describe("terbitBerikutnya", () => {
  it("bulan depan bila tanggal terbit bulan ini sudah lewat", () => {
    assert.deepEqual(terbitBerikutnya(1, "2026-09-24"), { periode: "2026-10", tanggal: "2026-10-01" });
    assert.deepEqual(terbitBerikutnya(25, "2026-12-26"), { periode: "2027-01", tanggal: "2027-01-25" });
  });

  it("bulan ini bila tanggal terbitnya hari ini atau belum lewat", () => {
    assert.deepEqual(terbitBerikutnya(25, "2026-09-24"), { periode: "2026-09", tanggal: "2026-09-25" });
    assert.deepEqual(terbitBerikutnya(24, "2026-09-24"), { periode: "2026-09", tanggal: "2026-09-24" });
  });
});

describe("jatuhTempoUntuk", () => {
  it("mengikuti tanggal masuk penghuni", () => {
    assert.equal(jatuhTempoUntuk({ aturan: "tanggal_masuk" }, "2026-10", "2025-03-15"), "2026-10-15");
  });

  it("dipotong ke akhir bulan untuk bulan pendek", () => {
    assert.equal(jatuhTempoUntuk({ aturan: "tanggal_masuk" }, "2027-02", "2025-08-30"), "2027-02-28");
    assert.equal(jatuhTempoUntuk({ aturan: "tanggal_masuk" }, "2028-02", "2025-08-30"), "2028-02-29");
  });

  it("tanggal tetap untuk semua penghuni", () => {
    assert.equal(jatuhTempoUntuk({ aturan: "tanggal_tetap", tanggal: 10 }, "2026-10", "2025-03-15"), "2026-10-10");
  });
});

describe("peringatanJadwal & ringkasJadwal", () => {
  it("aman: terbit tgl 1, jatuh tempo ikut tanggal masuk", () => {
    const p = { aktif: true, tanggalTerbit: 1, jatuhTempo: { aturan: "tanggal_masuk" as const } };
    assert.deepEqual(peringatanJadwal(p), []);
    assert.equal(ringkasJadwal(p), "Terbit tiap tanggal 1, jatuh tempo mengikuti tanggal masuk penghuni.");
  });

  it("jatuh tempo tetap sebelum tanggal terbit", () => {
    const p = { aktif: true, tanggalTerbit: 10, jatuhTempo: { aturan: "tanggal_tetap" as const, tanggal: 5 } };
    assert.equal(peringatanJadwal(p).length, 1);
    assert.equal(ringkasJadwal(p), "Terbit tiap tanggal 10, jatuh tempo tiap tanggal 5.");
  });

  it("tanggal masuk dengan tanggal terbit setelah tanggal 1", () => {
    const p = { aktif: true, tanggalTerbit: 5, jatuhTempo: { aturan: "tanggal_masuk" as const } };
    assert.match(peringatanJadwal(p)[0], /sebelum tanggal 5/);
  });
});
