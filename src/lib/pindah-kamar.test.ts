import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { kamarTujuan } from "./pindah-kamar.ts";

const k = (id: string, tipe: string, status: "terisi" | "kosong") => ({
  id,
  nomorKamar: id,
  tipe,
  status,
});

describe("kamarTujuan", () => {
  it("hanya kamar kosong, tipe yang sama di atas lalu urut nomor", () => {
    const semua = [
      k("A05", "Standar", "terisi"),
      k("C03", "AC", "kosong"),
      k("A11", "Standar", "kosong"),
      k("B05", "KM Dalam", "kosong"),
      k("A07", "Standar", "kosong"),
      k("A06", "Standar", "terisi"),
    ];
    assert.deepEqual(
      kamarTujuan(semua, { id: "A05", tipe: "Standar" }).map((x) => x.id),
      ["A07", "A11", "B05", "C03"],
    );
  });

  it("tidak ada kamar kosong → kosong", () => {
    assert.deepEqual(kamarTujuan([k("A01", "Standar", "terisi")], { id: "A01", tipe: "Standar" }), []);
  });
});
