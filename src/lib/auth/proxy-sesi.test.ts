import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { keputusanProxy } from "./proxy-sesi.ts";

const minta = (path: string, cookie?: string) =>
  keputusanProxy(new Request(`https://kostera.id${path}`, { headers: cookie ? { cookie } : {} }));

describe("proxy: pemeriksaan awal sesi", () => {
  it("tanpa cookie sesi: halaman → masuk, API → tolak", () => {
    assert.equal(minta("/dashboard"), "ke_masuk");
    assert.equal(minta("/pilih-kos"), "ke_masuk");
    assert.equal(minta("/api/dashboard/ringkasan"), "tolak_api");
    assert.equal(minta("/dashboard", "better-auth.session_token=abc"), "ke_masuk");
  });

  it("dengan cookie sesi Kostera (biasa maupun __Secure-) diteruskan", () => {
    assert.equal(minta("/tagihan", "kostera.session_token=abc"), "lanjut");
    assert.equal(minta("/api/kosta/pesan", "a=1; __Secure-kostera.session_token=abc"), "lanjut");
  });
});
