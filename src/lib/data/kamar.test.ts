import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import type { Db } from "../../db/index.ts";
import * as schema from "../../db/schema.ts";
import { isiDataContoh } from "../../db/seed.ts";
import { buatDbUji } from "../../db/testing.ts";
import { getDaftarKamarPenghuni, getKamarKosong, getPenghuniNonaktif } from "./kamar.ts";

describe("getDaftarKamarPenghuni", () => {
  let db: Db;
  let tutup: () => Promise<void>;

  before(async () => {
    ({ db, tutup } = await buatDbUji());
    await isiDataContoh(db);
    await db.insert(schema.users).values({ id: "usr_lain", nama: "Owner Lain", nomorWa: "6280000000001" });
    await db.insert(schema.organizations).values({ id: "org_lain", namaKos: "Kos Lain", jumlahKamar: 1, ownerId: "usr_lain" });
    await db.insert(schema.rooms).values({ id: "room_lain", organizationId: "org_lain", nomorKamar: "Z01", tipe: "Standar", hargaSewa: 400_000 });
  });
  after(() => tutup());

  it("40 kamar Kos Melati urut nomor, 34 dengan penghuni aktif", async () => {
    const daftar = await getDaftarKamarPenghuni(db, "org_kos_melati");
    assert.equal(daftar.length, 40);
    assert.equal(daftar.filter((k) => k.penghuni).length, 34);
    assert.deepEqual(daftar.slice(0, 2).map((k) => k.nomorKamar), ["A01", "A02"]);
    assert.ok(daftar.every((k) => k.nomorKamar !== "Z01"));
  });

  it("kamar terisi membawa data penghuni; kamar kosong tidak", async () => {
    const daftar = await getDaftarKamarPenghuni(db, "org_kos_melati");
    const a01 = daftar.find((k) => k.nomorKamar === "A01")!;
    assert.equal(a01.status, "terisi");
    assert.deepEqual(
      { nama: a01.penghuni?.nama, tanggalMasuk: a01.penghuni?.tanggalMasuk, sewa: a01.penghuni?.hargaSewa },
      { nama: "Dimas Pratama", tanggalMasuk: "2025-02-03", sewa: 500_000 },
    );
    const a07 = daftar.find((k) => k.nomorKamar === "A07")!;
    assert.equal(a07.status, "kosong");
    // Mantan penghuni A07 (keluar) tidak dihitung sebagai penghuni.
    assert.equal(a07.penghuni, undefined);
  });

  it("tagihan belum lunas per penghuni", async () => {
    const daftar = await getDaftarKamarPenghuni(db, "org_kos_melati");
    const tagihan = (kamar: string) => daftar.find((k) => k.nomorKamar === kamar)?.penghuni?.tagihanTerbuka;
    assert.deepEqual(tagihan("A05"), { jumlah: 1, nominal: 500_000 }); // jatuh tempo
    assert.deepEqual(tagihan("C09"), { jumlah: 1, nominal: 800_000 }); // perlu review
    assert.deepEqual(tagihan("A01"), { jumlah: 0, nominal: 0 }); // lunas
  });

  it("penghuni nonaktif, yang terakhir keluar di atas", async () => {
    const nonaktif = await getPenghuniNonaktif(db, "org_kos_melati");
    assert.deepEqual(
      nonaktif.map((p) => [p.nama, p.nomorKamar, p.tanggalKeluar]),
      [
        ["Mega Lestari", "B05", "2026-08-31"],
        ["Rudi Hartono", "A07", "2026-06-30"],
      ],
    );
    assert.deepEqual(await getPenghuniNonaktif(db, "org_lain"), []);
  });

  it("kamar kosong urut nomor, dengan penghuni terakhir yang keluar", async () => {
    const kosong = await getKamarKosong(db, "org_kos_melati");
    assert.deepEqual(
      kosong.map((k) => [k.nomorKamar, k.tipe, k.hargaSewa, k.kosongSejak, k.penghuniTerakhir]),
      [
        ["A07", "Standar", 500_000, "2026-06-30", "Rudi Hartono"],
        ["A11", "Standar", 500_000, undefined, undefined],
        ["B05", "KM Dalam", 650_000, "2026-08-31", "Mega Lestari"],
        ["B13", "KM Dalam", 650_000, undefined, undefined],
        ["C03", "AC", 800_000, undefined, undefined],
        ["C10", "AC", 800_000, undefined, undefined],
      ],
    );
    assert.deepEqual(
      (await getKamarKosong(db, "org_lain")).map((k) => k.nomorKamar),
      ["Z01"],
    );
  });
});
