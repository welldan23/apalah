import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  keteranganWaktu,
  parseUrutInvoice,
  peringatanTagihan,
  urutkanInvoice,
} from "./invoice.ts";

const baris = [
  { nomorKamar: "B10", namaPenghuni: "Arif", nominal: 650_000, jatuhTempo: "2026-09-16" },
  { nomorKamar: "A05", namaPenghuni: "Rizky", nominal: 500_000, jatuhTempo: "2026-09-15" },
  { nomorKamar: "C05", namaPenghuni: "Nadia", nominal: 800_000, jatuhTempo: "2026-09-20" },
  { nomorKamar: "B2", namaPenghuni: "Dewi", nominal: 650_000, jatuhTempo: "2026-09-18" },
];
const kamar = (daftar: typeof baris) => daftar.map((b) => b.nomorKamar);

describe("urutkanInvoice", () => {
  it("prioritas mempertahankan urutan server", () => {
    assert.deepEqual(kamar(urutkanInvoice(baris, "prioritas")), ["B10", "A05", "C05", "B2"]);
  });

  it("jatuh tempo terdekat, nominal terbesar, nama A–Z", () => {
    assert.deepEqual(kamar(urutkanInvoice(baris, "jatuh_tempo")), ["A05", "B10", "B2", "C05"]);
    // Nominal sama (650rb) tetap urutan semula.
    assert.deepEqual(kamar(urutkanInvoice(baris, "nominal")), ["C05", "B10", "B2", "A05"]);
    assert.deepEqual(kamar(urutkanInvoice(baris, "nama")), ["B10", "B2", "C05", "A05"]);
  });

  it("nomor kamar diurutkan secara alami (B2 sebelum B10)", () => {
    assert.deepEqual(kamar(urutkanInvoice(baris, "kamar")), ["A05", "B2", "B10", "C05"]);
  });

  it("tidak mengubah array asli", () => {
    urutkanInvoice(baris, "nominal");
    assert.deepEqual(kamar(baris), ["B10", "A05", "C05", "B2"]);
  });

  it("parseUrutInvoice", () => {
    assert.equal(parseUrutInvoice("nominal"), "nominal");
    assert.equal(parseUrutInvoice("acak"), "prioritas");
    assert.equal(parseUrutInvoice(null), "prioritas");
  });
});

describe("keteranganWaktu", () => {
  it("lunas, lewat, hari ini, dan sisa hari", () => {
    const teks = (inv: Parameters<typeof keteranganWaktu>[0]) =>
      keteranganWaktu(inv, "2026-09-24").teks;
    assert.equal(
      teks({ status: "lunas", dibayarPada: "2026-09-20", jatuhTempo: "2026-09-19" }),
      "Dibayar 20 Sep",
    );
    assert.equal(teks({ status: "jatuh_tempo", jatuhTempo: "2026-09-15" }), "Lewat 9 hari");
    assert.equal(teks({ status: "menunggu", jatuhTempo: "2026-09-24" }), "Jatuh tempo hari ini");
    assert.equal(teks({ status: "menunggu", jatuhTempo: "2026-09-26" }), "2 hari lagi");
    assert.equal(keteranganWaktu({ status: "jatuh_tempo", jatuhTempo: "2026-09-15" }, "2026-09-24").telat, true);
  });
});

describe("peringatanTagihan", () => {
  const hariIni = "2026-09-24";

  it("tanpa peringatan bila jatuh tempo di dalam periode dan belum lewat", () => {
    assert.deepEqual(peringatanTagihan({ periode: "2026-10", jatuhTempo: "2026-10-10", hariIni }), []);
  });

  it("jatuh tempo sudah lewat", () => {
    const [p] = peringatanTagihan({ periode: "2026-09", jatuhTempo: "2026-09-10", hariIni });
    assert.match(p, /sudah lewat/);
  });

  it("jatuh tempo di luar periode", () => {
    const [p] = peringatanTagihan({ periode: "2026-10", jatuhTempo: "2026-11-05", hariIni });
    assert.match(p, /di luar periode Oktober 2026/);
  });
});
