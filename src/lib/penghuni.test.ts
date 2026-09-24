import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { lamaTinggal } from "./penghuni.ts";

describe("lamaTinggal", () => {
  it("tahun dan bulan", () => {
    assert.equal(lamaTinggal("2024-03-01", "2026-06-30"), "2 tahun 3 bulan");
    assert.equal(lamaTinggal("2025-01-10", "2026-01-10"), "1 tahun");
    assert.equal(lamaTinggal("2025-01-10", "2025-06-12"), "5 bulan");
  });

  it("bulan belum genap tidak dihitung", () => {
    assert.equal(lamaTinggal("2025-01-10", "2025-02-09"), "< 1 bulan");
    assert.equal(lamaTinggal("2025-01-31", "2025-03-01"), "1 bulan");
  });
});
