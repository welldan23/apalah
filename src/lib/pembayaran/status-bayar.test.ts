import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { statusAkhir, statusKonfirmasi } from "./status-bayar.ts";

describe("status konfirmasi pembayaran", () => {
  const awal = { sudahDiterima: 0, pembayaran: [] };

  it("belum ada pembayaran baru → menunggu; baru tercatat pending → diproses", () => {
    assert.equal(statusKonfirmasi(awal, { status: "jatuh_tempo", sudahDiterima: 0, pembayaran: [] }), "menunggu");
    assert.equal(statusKonfirmasi(awal, { status: "jatuh_tempo", sudahDiterima: 0, pembayaran: [{ status: "pending" }] }), "diproses");
  });

  it("lunas → lunas; uang baru masuk tapi tidak cocok → diperiksa", () => {
    assert.equal(statusKonfirmasi(awal, { status: "lunas", sudahDiterima: 500_000, pembayaran: [{ status: "valid" }] }), "lunas");
    assert.equal(
      statusKonfirmasi(awal, { status: "perlu_review", sudahDiterima: 450_000, pembayaran: [{ status: "tidak_cocok" }] }),
      "diperiksa",
    );
  });

  it("tagihan yang sejak awal sedang diperiksa: menunggu sampai ada uang baru", () => {
    const c09 = { sudahDiterima: 750_000, pembayaran: [{ status: "tidak_cocok" as const }] };
    assert.equal(statusKonfirmasi(c09, { status: "perlu_review", ...c09 }), "menunggu");
    assert.equal(
      statusKonfirmasi(c09, { status: "perlu_review", sudahDiterima: 750_000, pembayaran: [...c09.pembayaran, { status: "pending" }] }),
      "diproses",
    );
    assert.equal(
      statusKonfirmasi(c09, { status: "lunas", sudahDiterima: 800_000, pembayaran: [...c09.pembayaran, { status: "valid" }] }),
      "lunas",
    );
    assert.deepEqual(["menunggu", "diproses", "lunas", "diperiksa"].map((s) => statusAkhir(s as never)), [false, false, true, true]);
  });
});
