import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { cariMetode, formatNomorVa, formatSisaWaktu, langkahBayar, METODE_BAYAR, sisaTagihan } from "./metode.ts";

describe("metode bayar via tautan", () => {
  it("QRIS dulu (15 menit), lalu Virtual Account bank (24 jam)", () => {
    assert.deepEqual(METODE_BAYAR.map((m) => m.id), ["qris", "va_bca", "va_bni", "va_bri", "va_mandiri", "va_permata"]);
    assert.equal(cariMetode("qris")?.masaBerlakuMenit, 15);
    assert.deepEqual([cariMetode("va_bni")?.label, cariMetode("va_bni")?.masaBerlakuMenit], ["Virtual Account BNI", 1440]);
    assert.equal(cariMetode("kartu_kredit"), undefined);
  });

  it("yang harus dibayar = sisa tagihan, tidak pernah negatif", () => {
    assert.equal(sisaTagihan(800_000, 0), 800_000);
    assert.equal(sisaTagihan(800_000, 750_000), 50_000);
    assert.equal(sisaTagihan(800_000, 850_000), 0);
  });

  it("format nomor VA & sisa waktu", () => {
    assert.equal(formatNomorVa("8808123456789012"), "8808 1234 5678 9012");
    assert.equal(formatNomorVa("12345"), "1234 5");
    assert.equal(formatSisaWaktu(14 * 60_000 + 59_000), "14:59");
    assert.equal(formatSisaWaktu(9_000), "0:09");
    assert.equal(formatSisaWaktu(-5), "0:00");
    assert.equal(formatSisaWaktu(23 * 3_600_000 + 59 * 60_000), "23 jam 59 menit");
  });

  it("langkah bayar sesuai metode", () => {
    assert.match(langkahBayar(cariMetode("qris")!, "Rp50.000").join(" "), /Scan kode QR[\s\S]*Rp50\.000/);
    assert.match(langkahBayar(cariMetode("va_mandiri")!, "Rp800.000")[0], /m-banking\/ATM Mandiri/);
  });
});
