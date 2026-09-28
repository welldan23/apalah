import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { cocokkanNominal, ringkasKeputusan } from "./pencocokan.ts";

describe("cocokkanNominal", () => {
  const cek = (nominalTagihan: number, sudahDiterima: number, nominalBayar: number) =>
    cocokkanNominal({ nominalTagihan, sudahDiterima, nominalBayar });

  it("total pas → Lunas", () => {
    assert.deepEqual(cek(500_000, 0, 500_000), { alasan: "cocok", statusInvoice: "lunas", statusPembayaran: "valid", selisih: 0 });
    assert.equal(cek(800_000, 750_000, 50_000).alasan, "cocok");
  });

  it("kurang, lebih, dan bayar ganda → Perlu review dengan selisih", () => {
    assert.deepEqual(cek(500_000, 0, 450_000), { alasan: "kurang", statusInvoice: "perlu_review", statusPembayaran: "tidak_cocok", selisih: -50_000 });
    assert.equal(cek(500_000, 0, 550_000).alasan, "lebih");
    assert.deepEqual(cek(500_000, 500_000, 500_000).selisih, 500_000);
  });

  it("ringkasan untuk catatan webhook", () => {
    assert.equal(ringkasKeputusan(cek(500_000, 0, 500_000)), "lunas");
    assert.equal(ringkasKeputusan(cek(500_000, 0, 450_000)), "perlu_review: kurang Rp50.000");
    assert.equal(ringkasKeputusan(cek(500_000, 500_000, 500_000)), "perlu_review: lebih Rp500.000");
  });
});
