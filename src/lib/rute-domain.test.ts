import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { aturanDomain } from "./rute-domain.ts";

const WARISAN = { source: "/app/:path*", destination: "/masuk", permanent: false };

/** Next mencocokkan `has.host` sebagai regex utuh (^…$) terhadap hostname tanpa port. */
const cocokHost = (pola: string, host: string) => new RegExp(`^${pola}$`).test(host);
/** Regex parameter `/:path(…)` → apakah path (tanpa "/" di depan) ikut dialihkan. */
const dialihkan = (source: string, path: string) => new RegExp(`^${source.match(/^\/:path\((.*)\)$/)![1]}$`).test(path);

describe("pembagian domain landing & aplikasi", () => {
  it("tanpa LANDING_URL (lokal, *.vercel.app) atau domain sama: hanya pengalihan link aplikasi lama", () => {
    assert.deepEqual(aturanDomain({}), [WARISAN]);
    assert.deepEqual(aturanDomain({ APP_URL: "https://app.kostera.id" }), [WARISAN]);
    assert.deepEqual(aturanDomain({ APP_URL: "https://kostera.id", LANDING_URL: "https://kostera.id/" }), [WARISAN]);
    assert.deepEqual(aturanDomain({ APP_URL: "bukan url", LANDING_URL: "https://kostera.id" }), [WARISAN]);
  });

  it("kostera.id + app.kostera.id: beranda aplikasi ke dashboard, halaman aplikasi di landing pindah ke app", () => {
    const [warisan, beranda, landing] = aturanDomain({ APP_URL: "https://app.kostera.id", LANDING_URL: "https://kostera.id" });
    assert.deepEqual(warisan, WARISAN);
    assert.deepEqual(beranda, { source: "/", has: [{ type: "host", value: "app\\.kostera\\.id" }], destination: "/dashboard", permanent: false });
    assert.equal(landing.destination, "https://app.kostera.id/:path");
    assert.equal(landing.permanent, false);

    // Pola host presisi: aturan landing tidak pernah berlaku di app.kostera.id (tidak ada redirect berputar).
    const polaLanding = landing.has![0].value;
    assert.equal(cocokHost(polaLanding, "kostera.id"), true);
    assert.equal(cocokHost(polaLanding, "app.kostera.id"), false);
    assert.equal(cocokHost(polaLanding, "kosteraxid"), false);
    assert.equal(cocokHost(beranda.has![0].value, "kostera.id"), false);

    for (const path of ["daftar", "masuk", "dashboard", "invoice/abc123", "api/webhook/whatsapp", "app/"]) {
      assert.equal(dialihkan(landing.source, path), true, path);
    }
    for (const path of ["_next/static/chunks/a.js", "_next/image", "api/landing/konten", "favicon.ico", "robots.txt", "sitemap.xml"]) {
      assert.equal(dialihkan(landing.source, path), false, path);
    }
  });
});
