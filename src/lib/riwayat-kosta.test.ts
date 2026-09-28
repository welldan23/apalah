import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PesanKosta } from "@/lib/types";

import { labelHari, ringkasRiwayat } from "./riwayat-kosta.ts";

const pesan = (id: string, dari: PesanKosta["dari"], waktu: string, teks: string): PesanKosta => ({
  id,
  dari,
  waktu,
  teks,
});

describe("ringkasRiwayat", () => {
  const riwayat = ringkasRiwayat([
    pesan("1", "owner", "2026-09-22T19:30:00+07:00", "Kamar A03 sudah bayar belum?"),
    pesan("2", "kosta", "2026-09-22T19:30:00+07:00", "Belum."),
    // 23.30 UTC tanggal 23 = 06.30 WIB tanggal 24 → masuk hari 24 (WIB).
    pesan("3", "kosta", "2026-09-23T23:30:00Z", "Selamat pagi!"),
    pesan("4", "owner", "2026-09-24T08:02:00+07:00", "Berapa tunggakan bulan ini?"),
    {
      ...pesan("5", "kosta", "2026-09-24T08:10:00+07:00", "Ini preview-nya."),
      lampiran: {
        jenis: "preview_aksi",
        aksi: "reminder",
        periode: "2026-09",
        penerima: [],
        total: 0,
        status: "dijalankan",
      },
    },
  ]);

  it("dikelompokkan per hari WIB, terbaru di atas", () => {
    assert.deepEqual(
      riwayat.map((h) => [h.tanggal, h.jumlahPesan]),
      [
        ["2026-09-24", 3],
        ["2026-09-22", 2],
      ],
    );
  });

  it("topik = pertanyaan owner pertama; aksi dicatat dengan statusnya", () => {
    assert.equal(riwayat[0].topik, "Berapa tunggakan bulan ini?");
    assert.deepEqual(riwayat[0].aksi, [{ aksi: "reminder", status: "dijalankan" }]);
    assert.equal(riwayat[1].topik, "Kamar A03 sudah bayar belum?");
    assert.deepEqual(riwayat[1].aksi, []);
  });
});

describe("labelHari", () => {
  it("Hari ini, Kemarin, atau tanggal", () => {
    assert.equal(labelHari("2026-09-24", "2026-09-24"), "Hari ini");
    assert.equal(labelHari("2026-09-23", "2026-09-24"), "Kemarin");
    assert.equal(labelHari("2026-08-31", "2026-09-01"), "Kemarin");
    assert.equal(labelHari("2026-09-20", "2026-09-24"), "20 Sep 2026");
  });
});
