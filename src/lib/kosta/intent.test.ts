import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalisasiKamar, parseCepat, parseKataKunci, periodeDariTeks, validasiIntent } from "./intent.ts";

const HARI_INI = "2026-09-24";

describe("parseCepat", () => {
  it("konfirmasi & ganti kos", () => {
    for (const t of ["Ya", "iya kirim", "OK!", "setuju", "gas"]) assert.deepEqual(parseCepat(t), { intent: "konfirmasi", setuju: true }, t);
    for (const t of ["batal", "Tidak.", "jangan kirim", "gak dulu"]) assert.deepEqual(parseCepat(t), { intent: "konfirmasi", setuju: false }, t);
    assert.deepEqual(parseCepat("ganti kos"), { intent: "ganti_kos" });
  });

  it("kalimat biasa bukan perintah pasti", () => {
    assert.equal(parseCepat("ya berapa tunggakan bulan ini"), null);
    assert.equal(parseCepat("tidak ada yang telat kan?"), null);
  });
});

describe("periodeDariTeks", () => {
  it("relatif & nama bulan", () => {
    assert.equal(periodeDariTeks("bulan ini", HARI_INI), undefined);
    assert.equal(periodeDariTeks("rekap bulan lalu", HARI_INI), "2026-08");
    assert.equal(periodeDariTeks("tagihan bulan depan", HARI_INI), "2026-10");
    assert.equal(periodeDariTeks("pemasukan Agustus", HARI_INI), "2026-08");
    assert.equal(periodeDariTeks("tunggakan okt 2025", HARI_INI), "2025-10");
    assert.equal(periodeDariTeks("kamar kosong", HARI_INI), undefined);
  });
});

describe("parseKataKunci (cadangan tanpa LLM)", () => {
  const cek = (teks: string) => parseKataKunci(teks, HARI_INI);
  it("mengenali pertanyaan umum owner", () => {
    assert.deepEqual(cek("Kosta, berapa tunggakan bulan ini?"), { intent: "lihat_tunggakan" });
    assert.deepEqual(cek("Kamar mana yang masih kosong?"), { intent: "kamar_kosong" });
    assert.deepEqual(cek("Rekap pemasukan bulan lalu"), { intent: "rekap_pemasukan", periode: "2026-08" });
    assert.deepEqual(cek("Kamar A03 sudah bayar belum?"), { intent: "cek_kamar", nomorKamar: "A03" });
    assert.deepEqual(cek("Siapkan reminder buat yang menunggak"), { intent: "siapkan_reminder" });
    assert.deepEqual(cek("tolong buat tagihan oktober"), { intent: "draft_tagihan", periode: "2026-10" });
    assert.deepEqual(cek("pindahkan penghuni a5 ke b 13"), { intent: "pindah_penghuni", dariKamar: "A05", keKamar: "B13" });
    assert.deepEqual(cek("cuaca hari ini gimana"), { intent: "bantuan" });
  });
});

describe("validasiIntent (hasil LLM)", () => {
  it("parameter disaring; intent/parameter tidak sah → bantuan", () => {
    assert.deepEqual(validasiIntent({ intent: "lihat_tunggakan", periode: "2026-13", total: 999 }), { intent: "lihat_tunggakan" });
    assert.deepEqual(validasiIntent({ intent: "rekap_pemasukan", periode: "2026-08" }), { intent: "rekap_pemasukan", periode: "2026-08" });
    assert.deepEqual(validasiIntent({ intent: "cek_kamar", nomorKamar: "c 9" }), { intent: "cek_kamar", nomorKamar: "C09" });
    assert.deepEqual(validasiIntent({ intent: "cek_kamar", nomorKamar: "DROP TABLE" }), { intent: "bantuan" });
    assert.deepEqual(validasiIntent({ intent: "pindah_penghuni", dariKamar: "A05", keKamar: "A05" }), { intent: "bantuan" });
    assert.deepEqual(validasiIntent({ intent: "konfirmasi", setuju: "ya" }), { intent: "bantuan" });
    assert.deepEqual(validasiIntent({ intent: "hapus_semua_data" }), { intent: "bantuan" });
    assert.deepEqual(validasiIntent(null), { intent: "bantuan" });
  });

  it("normalisasiKamar", () => {
    assert.equal(normalisasiKamar("a3"), "A03");
    assert.equal(normalisasiKamar("B-12"), "B12");
    assert.equal(normalisasiKamar("101"), "101");
    assert.equal(normalisasiKamar("kamar"), null);
  });
});
