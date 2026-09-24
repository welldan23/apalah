import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hitungTiket, KATEGORI_TIKET, labelKategori, periksaTiket, statusBerikutnya, urutkanTiket } from "./tiket.ts";

describe("tiket keluhan penyewa", () => {
  it("kategori tetap & labelnya", () => {
    assert.deepEqual(KATEGORI_TIKET.map((k) => k.id), ["perbaikan", "air_listrik", "kebersihan", "keamanan", "tagihan", "lainnya"]);
    assert.equal(labelKategori("air_listrik"), "Air & listrik");
    assert.equal(labelKategori("asing"), "Lainnya");
  });

  it("validasi kategori & deskripsi (spasi di tepi tidak dihitung)", () => {
    assert.deepEqual(periksaTiket({ kategori: "air_listrik", deskripsi: "Keran kamar mandi bocor sejak kemarin." }), {});
    assert.deepEqual(periksaTiket({ kategori: "", deskripsi: "   bocor   " }), {
      kategori: "Pilih jenis masalahnya.",
      deskripsi: "Ceritakan masalahnya minimal 10 karakter.",
    });
    assert.deepEqual(periksaTiket({ kategori: "lainnya", deskripsi: "x".repeat(1001) }), { deskripsi: "Maksimal 1000 karakter." });
  });

  it("urutan daftar: yang masih berjalan dulu, lalu selesai; terbaru di atas", () => {
    const t = (id: string, status: "baru" | "diproses" | "selesai", dibuatPada: string) => ({ id, status, dibuatPada });
    assert.deepEqual(
      urutkanTiket([
        t("a", "selesai", "2026-09-20T01:00:00Z"),
        t("b", "diproses", "2026-09-10T01:00:00Z"),
        t("c", "baru", "2026-09-22T01:00:00Z"),
        t("d", "selesai", "2026-09-23T01:00:00Z"),
      ]).map((x) => x.id),
      ["c", "b", "d", "a"],
    );
  });

  it("jumlah per status & langkah berikutnya untuk owner", () => {
    assert.deepEqual(hitungTiket([{ status: "baru" }, { status: "baru" }, { status: "selesai" }]), { baru: 2, diproses: 0, selesai: 1 });
    assert.deepEqual(["baru", "diproses", "selesai"].map((s) => statusBerikutnya(s as never)), ["diproses", "selesai", null]);
  });
});
