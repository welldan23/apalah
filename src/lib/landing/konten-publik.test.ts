import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { kontenPublik } from "./konten-publik.ts";

describe("kontenPublik", () => {
  const konten = kontenPublik();

  it("aman diserialisasi JSON tanpa kehilangan isi", () => {
    assert.deepEqual(JSON.parse(JSON.stringify(konten)), konten);
  });

  it("copy utama sesuai PRD", () => {
    assert.equal(konten.hero.judul, "Tagihan kos rapi, pembayaran lebih pasti");
    assert.equal(konten.hero.ctaUtama, "Mulai gratis");
    assert.deepEqual(
      konten.benefit.map((b) => b.judul),
      ["Tagihan terjadwal", "Pantau pembayaran", "Kamar rapi"],
    );
    assert.equal(konten.caraKerja.length, 3);
    assert.ok(konten.faq.length > 0);
  });

  it("ikon dikirim sebagai nama ikon Lucide", () => {
    assert.equal(konten.benefit[0].ikon, "CalendarClock");
    const semuaIkon = [
      ...konten.benefit,
      ...konten.caraKerja,
      ...konten.previewDashboard.aksi,
    ].map((x) => x.ikon);
    assert.ok(semuaIkon.every((nama) => /^[A-Z][A-Za-z0-9]+$/.test(nama)));
  });
});
