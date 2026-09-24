import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { antrianPengingat, JADWAL_BAWAAN, keteranganJadwal, labelJadwal, labelJenisReminder, periksaJadwal } from "./reminder.ts";

describe("label jadwal pengingat", () => {
  it("H-3 / H / H+3 dan kalimatnya", () => {
    assert.deepEqual(JADWAL_BAWAAN.map((j) => labelJadwal(j.offsetHari)), ["H-3", "H", "H+3"]);
    assert.equal(keteranganJadwal(-3), "3 hari sebelum jatuh tempo");
    assert.equal(keteranganJadwal(0), "Di hari jatuh tempo");
    assert.equal(keteranganJadwal(7), "7 hari setelah jatuh tempo");
    assert.equal(labelJenisReminder("manual"), "Manual");
    assert.equal(labelJenisReminder("H+3"), "H+3");
  });
});

describe("antrianPengingat", () => {
  const t = (jatuhTempo: string, nominal: number, status = "menunggu") => ({ jatuhTempo, nominal, status });

  it("mengelompokkan per tanggal & jenis dalam 7 hari ke depan", () => {
    const tagihan = [t("2026-09-26", 500_000), t("2026-09-28", 650_000), t("2026-09-26", 800_000), t("2026-09-22", 500_000, "jatuh_tempo")];
    assert.deepEqual(antrianPengingat(tagihan, JADWAL_BAWAAN, "2026-09-24"), [
      { tanggal: "2026-09-25", jenis: "H-3", jam: "09:00", jumlah: 1, nominal: 650_000 },
      { tanggal: "2026-09-25", jenis: "H+3", jam: "09:00", jumlah: 1, nominal: 500_000 },
      { tanggal: "2026-09-26", jenis: "H", jam: "09:00", jumlah: 2, nominal: 1_300_000 },
      { tanggal: "2026-09-28", jenis: "H", jam: "09:00", jumlah: 1, nominal: 650_000 },
      { tanggal: "2026-09-29", jenis: "H+3", jam: "09:00", jumlah: 2, nominal: 1_300_000 },
    ]);
  });

  it("tagihan lunas, jadwal nonaktif, dan tanggal yang sudah lewat diabaikan", () => {
    const jadwal = JADWAL_BAWAAN.map((j) => ({ ...j, aktif: j.offsetHari === 0 }));
    assert.deepEqual(antrianPengingat([t("2026-09-26", 1, "lunas"), t("2026-09-20", 1)], jadwal, "2026-09-24"), []);
    assert.deepEqual(antrianPengingat([t("2026-10-05", 1)], JADWAL_BAWAAN, "2026-09-24"), []);
  });
});

describe("periksaJadwal", () => {
  const j = (offsetHari: number, jam = "09:00") => ({ offsetHari, jam, aktif: true });
  it("jadwal valid & ubahan jadwal sendiri tidak dianggap bentrok", () => {
    assert.equal(periksaJadwal(j(-1), JADWAL_BAWAAN), "");
    assert.equal(periksaJadwal(j(-3, "07:30"), JADWAL_BAWAAN, 0), "");
  });
  it("menolak offset di luar batas, jam tidak wajar, bentrok, dan terlalu banyak", () => {
    assert.match(periksaJadwal(j(15), JADWAL_BAWAAN), /0–14 hari/);
    assert.match(periksaJadwal(j(1, "9:00"), JADWAL_BAWAAN), /Isi jam kirim/);
    assert.match(periksaJadwal(j(1, "22:00"), JADWAL_BAWAAN), /06\.00 dan 21\.00/);
    assert.match(periksaJadwal(j(0), JADWAL_BAWAAN), /Sudah ada jadwal H\./);
    assert.match(periksaJadwal(j(3), JADWAL_BAWAAN, 0), /Sudah ada jadwal H\+3/);
    const lima = [j(-5), j(-3), j(0), j(3), j(5)];
    assert.match(periksaJadwal(j(7), lima), /Maksimal 5 jadwal/);
  });
});
