import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hariIniWib, periodeValid, periodeWib, tanggalWib } from "./waktu.ts";

describe("waktu WIB", () => {
  it("pergantian hari mengikuti WIB, bukan UTC", () => {
    // 30 Sep 18.30 UTC = 1 Okt 01.30 WIB
    const t = new Date("2026-09-30T18:30:00Z");
    assert.equal(tanggalWib(t), "2026-10-01");
    assert.equal(hariIniWib(t), "2026-10-01");
    assert.equal(periodeWib(t), "2026-10");
  });

  it("periodeValid", () => {
    assert.equal(periodeValid("2026-09"), true);
    assert.equal(periodeValid("2026-13"), false);
    assert.equal(periodeValid("2026-9"), false);
    assert.equal(periodeValid("abc"), false);
  });
});
