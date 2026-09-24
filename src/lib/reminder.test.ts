import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  antrianPengingat,
  bolehDiingatkan,
  JADWAL_BAWAAN,
  jenisDiRiwayat,
  keteranganJadwal,
  labelJadwal,
  labelJenisReminder,
  parseStatusRiwayat,
  periksaJadwal,
  saringRiwayatReminder,
} from "./reminder.ts";

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

describe("bolehDiingatkan", () => {
  const sekarang = new Date("2026-09-24T09:00:00+07:00");
  it("belum pernah atau sudah ≥ 24 jam → boleh; kurang dari 24 jam → tidak", () => {
    assert.equal(bolehDiingatkan(undefined, sekarang), true);
    assert.equal(bolehDiingatkan("2026-09-23T09:00:00+07:00", sekarang), true);
    assert.equal(bolehDiingatkan("2026-09-23T10:00:00+07:00", sekarang), false);
  });
});

describe("saring riwayat reminder", () => {
  const riwayat = [
    { id: "1", jenis: "H+3", status: "terkirim", namaPenghuni: "Rizky Ramadhan", nomorKamar: "A05" },
    { id: "2", jenis: "manual", status: "gagal", namaPenghuni: "Dewi Lestari", nomorKamar: "B06" },
    { id: "3", jenis: "H", status: "gagal", namaPenghuni: "Tiara Ramadhani", nomorKamar: "B16" },
    { id: "4", jenis: "H-3", status: "terkirim", namaPenghuni: "Budi", nomorKamar: "C05" },
    { id: "5", jenis: "H-7", status: "terkirim", namaPenghuni: "Sari", nomorKamar: "A03" },
  ];
  const id = (hasil: { id: string }[]) => hasil.map((r) => r.id);

  it("status, jenis, dan kata kunci (nama/kamar, tanpa beda huruf besar) digabung", () => {
    assert.deepEqual(id(saringRiwayatReminder(riwayat, { status: "semua", jenis: "", cari: "" })), ["1", "2", "3", "4", "5"]);
    assert.deepEqual(id(saringRiwayatReminder(riwayat, { status: "gagal", jenis: "", cari: "" })), ["2", "3"]);
    assert.deepEqual(id(saringRiwayatReminder(riwayat, { status: "semua", jenis: "manual", cari: "" })), ["2"]);
    assert.deepEqual(id(saringRiwayatReminder(riwayat, { status: "semua", jenis: "", cari: " ramadhan" })), ["1", "3"]);
    assert.deepEqual(id(saringRiwayatReminder(riwayat, { status: "gagal", jenis: "", cari: "b1" })), ["3"]);
    assert.deepEqual(id(saringRiwayatReminder(riwayat, { status: "terkirim", jenis: "H", cari: "" })), []);
  });

  it("pilihan jenis urut Manual, H-x → H+x; status dari URL", () => {
    assert.deepEqual(jenisDiRiwayat([...riwayat, { jenis: "H-3" }, { jenis: "lain" }]), ["manual", "H-7", "H-3", "H", "H+3", "lain"]);
    assert.equal(parseStatusRiwayat("gagal"), "gagal");
    assert.equal(parseStatusRiwayat("lunas"), "semua");
    assert.equal(parseStatusRiwayat(null), "semua");
  });
});
