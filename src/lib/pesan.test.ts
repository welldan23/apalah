import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isiTemplate,
  pesanLunas,
  pesanOtp,
  pesanPengingat,
  pesanPengingatAwal,
  pesanTagihan,
  TEMPLATE_LUNAS,
  TEMPLATE_PENGINGAT,
  TEMPLATE_TAGIHAN,
  TEMPLATE_TIKET,
  templateLunas,
  templateOtp,
  templatePengingat,
  templateTagihan,
  templateTiket,
} from "./pesan.ts";

const inv = (jatuhTempo: string) => ({
  namaPenghuni: "Yoga Saputra",
  nomorKamar: "A03",
  periode: "2026-09",
  nominal: 500_000,
  jatuhTempo,
});

describe("template pengingat", () => {
  it("sebelum jatuh tempo menyebut sisa hari", () => {
    assert.equal(
      pesanPengingatAwal(inv("2026-09-26"), "Kos Melati", "2026-09-24"),
      "Halo Yoga, pengingat dari Kos Melati: tagihan sewa kamar A03 periode September 2026 sebesar Rp500.000 jatuh tempo 26 Sep 2026 (2 hari lagi). Silakan bayar lewat link invoice berikut. Terima kasih.",
    );
    assert.match(pesanPengingatAwal(inv("2026-09-24"), "Kos Melati", "2026-09-24", "https://x/i"), /jatuh tempo hari ini\. [\s\S]*\nhttps:\/\/x\/i$/);
  });

  it("memilih template lewat jatuh tempo bila tanggalnya sudah lewat", () => {
    assert.match(pesanPengingat(inv("2026-09-20"), "Kos Melati", "2026-09-24"), /sudah lewat jatuh tempo \(20 Sep 2026\)/);
    assert.match(pesanPengingat(inv("2026-09-25"), "Kos Melati", "2026-09-24"), /1 hari lagi/);
  });
});

describe("template WhatsApp resmi pengingat", () => {
  it("isi template + variabel = teks yang dikirim provider teks (tanpa baris link)", () => {
    for (const [jatuhTempo, nama] of [
      ["2026-09-26", "kostera_pengingat_sebelum"],
      ["2026-09-24", "kostera_pengingat_sebelum"],
      ["2026-09-20", "kostera_pengingat_lewat"],
    ]) {
      const t = templatePengingat(inv(jatuhTempo), "Kos Melati", "2026-09-24", "demo-a03-2026-09");
      assert.equal(t.nama, nama);
      assert.deepEqual([t.bahasa, t.tombolUrl], ["id", "demo-a03-2026-09"]);
      const isi = Object.values(TEMPLATE_PENGINGAT).find((d) => d.nama === t.nama)!.isi;
      assert.equal(isiTemplate(isi, t.variabel), pesanPengingat(inv(jatuhTempo), "Kos Melati", "2026-09-24"));
    }
  });

  it("memenuhi aturan Meta: variabel {{1}}…{{n}} berurutan, tidak di awal/akhir isi, nilai tanpa baris baru", () => {
    const semua = [...Object.values(TEMPLATE_PENGINGAT), TEMPLATE_TAGIHAN, TEMPLATE_LUNAS, TEMPLATE_TIKET];
    for (const { isi } of semua) {
      const nomor = [...isi.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
      assert.deepEqual(nomor, Array.from({ length: nomor.length }, (_, i) => i + 1));
      assert.doesNotMatch(isi, /^\{\{|\}\}$/);
    }
    assert.equal(new Set(semua.map((t) => t.nama)).size, semua.length);
    for (const t of [
      templatePengingat(inv("2026-09-20"), "Kos Melati", "2026-09-24", "x"),
      templateTagihan(inv("2026-09-20"), "Kos Melati", "x"),
      templateLunas(inv("2026-09-20"), "Kos Melati", "x"),
      templateTiket(
        { namaPenghuni: "Yoga Saputra", nomorTiket: "TKT-0015", jenis: "Air & listrik", nomorKamar: "A03", status: "selesai" },
        "Kos Melati",
        "x",
      ),
    ]) {
      assert.ok(t.variabel.every((v) => v && !/[\n\t]| {5}/.test(v)));
    }
  });
});

describe("template WhatsApp resmi tagihan baru & pembayaran diterima", () => {
  const LINK = "https://kostera.id/invoice/demo-a03-2026-09";

  it("tagihan baru: teks provider teks = isi template + baris link; tombol ke invoice", () => {
    const teks = pesanTagihan(inv("2026-09-26"), "Kos Melati", LINK);
    assert.equal(
      teks,
      `Halo Yoga, ini tagihan sewa kamar A03 di Kos Melati periode September 2026 sebesar Rp500.000, jatuh tempo 26 Sep 2026. Rincian dan cara bayar ada di link berikut. Terima kasih.\n${LINK}`,
    );
    const t = templateTagihan(inv("2026-09-26"), "Kos Melati", "demo-a03-2026-09");
    assert.deepEqual([t.nama, t.bahasa, t.tombolUrl], ["kostera_tagihan_baru", "id", "demo-a03-2026-09"]);
    assert.equal(`${isiTemplate(TEMPLATE_TAGIHAN.isi, t.variabel)}\n${LINK}`, teks);
  });

  it("pembayaran diterima: teks provider teks = isi template + baris link; tombol ke bukti bayar", () => {
    const teks = pesanLunas(inv("2026-09-26"), "Kos Melati", LINK);
    assert.equal(
      teks,
      `Halo Yoga, pembayaran sewa kamar A03 di Kos Melati periode September 2026 sebesar Rp500.000 sudah kami terima. Terima kasih! Bukti pembayaran:\n${LINK}`,
    );
    const t = templateLunas(inv("2026-09-26"), "Kos Melati", "demo-a03-2026-09");
    assert.deepEqual([t.nama, t.bahasa, t.tombolUrl], ["kostera_pembayaran_diterima", "id", "demo-a03-2026-09"]);
    assert.equal(`${isiTemplate(TEMPLATE_LUNAS.isi, t.variabel)}\n${LINK}`, teks);
  });
});

describe("pesan kode OTP", () => {
  it("teks untuk WAHA/log & template autentikasi resmi", () => {
    assert.equal(
      pesanOtp("482913", 5),
      "Kode verifikasi Kostera kamu: 482913. Berlaku 5 menit. Jangan berikan kode ini ke siapa pun, termasuk yang mengaku dari Kostera.",
    );
    assert.deepEqual(templateOtp("482913"), { nama: "kostera_kode_otp", bahasa: "id", variabel: ["482913"], tombolUrl: "482913" });
  });
});
