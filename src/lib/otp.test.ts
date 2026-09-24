import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { bersihkanKodeOtp, formatHitungMundur } from "./otp.ts";

describe("kode OTP", () => {
  it("hanya digit, maksimal 6", () => {
    assert.equal(bersihkanKodeOtp("123 456"), "123456");
    assert.equal(bersihkanKodeOtp("Kode: 98-76-54-32"), "987654");
    assert.equal(bersihkanKodeOtp("abc"), "");
  });

  it("hitung mundur kirim ulang", () => {
    assert.equal(formatHitungMundur(60), "1:00");
    assert.equal(formatHitungMundur(75), "1:15");
    assert.equal(formatHitungMundur(9), "0:09");
  });
});
