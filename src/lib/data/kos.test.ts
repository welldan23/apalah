import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import type { Db } from "../../db/index.ts";
import * as schema from "../../db/schema.ts";
import { isiDataContoh } from "../../db/seed.ts";
import { buatDbUji } from "../../db/testing.ts";
import { ubahKamar } from "../aksi/kamar.ts";
import { getRingkasanKos } from "./kos.ts";

describe("getRingkasanKos", () => {
  let db: Db;
  let tutup: () => Promise<void>;

  before(async () => {
    ({ db, tutup } = await buatDbUji());
    await isiDataContoh(db);
    // Kos lain dengan nomor kamar yang sama — tidak boleh ikut terhitung.
    await db.insert(schema.users).values({ id: "usr_lain", nama: "Owner Lain", nomorWa: "6280000000001" });
    await db.insert(schema.organizations).values({
      id: "org_lain",
      namaKos: "Kos Lain",
      jumlahKamar: 1,
      ownerId: "usr_lain",
    });
    await db.insert(schema.rooms).values({
      id: "room_lain_A01",
      organizationId: "org_lain",
      nomorKamar: "A01",
      tipe: "Standar",
      hargaSewa: 400_000,
      status: "terisi",
    });
    await db.insert(schema.tenants).values({
      organizationId: "org_lain",
      nama: "Penghuni Kos Lain",
      nomorWa: "6280000000002",
      roomId: "room_lain_A01",
      tanggalMasuk: "2026-01-01",
      hargaSewa: 400_000,
    });
  });
  after(() => tutup());

  it("angka kamar Kos Melati sesuai PRD: 40 kamar, 34 terisi", async () => {
    const ringkasan = await getRingkasanKos(db, "org_kos_melati");
    assert.ok(ringkasan);
    assert.equal(ringkasan.organization.namaKos, "Kos Melati");
    assert.equal(ringkasan.kamar.total, 40);
    assert.equal(ringkasan.kamar.terisi, 34);
    assert.equal(ringkasan.kamar.kosong, 6);
    assert.equal(ringkasan.kamar.persenTerisi, 85);
    assert.equal(ringkasan.kamar.potensiSewaKosong, 3_900_000);
    assert.equal(ringkasan.kamar.nonaktif, 0);
    assert.deepEqual(ringkasan.kamar.perTipe, [
      { tipe: "Standar", hargaSewa: 500_000, total: 12, terisi: 10 },
      { tipe: "KM Dalam", hargaSewa: 650_000, total: 16, terisi: 14 },
      { tipe: "AC", hargaSewa: 800_000, total: 12, terisi: 10 },
    ]);
  });

  it("daftar kamar urut nomor, penghuni aktif ikut tampil", async () => {
    const { kamar } = (await getRingkasanKos(db, "org_kos_melati"))!;
    assert.deepEqual(
      kamar.daftar.slice(0, 3).map((k) => k.nomorKamar),
      ["A01", "A02", "A03"],
    );
    assert.equal(kamar.daftar[0].namaPenghuni, "Dimas Pratama");
    const a07 = kamar.daftar.find((k) => k.nomorKamar === "A07");
    assert.equal(a07?.status, "kosong");
    assert.equal(a07?.namaPenghuni, undefined);
  });

  it("hanya membaca kamar milik organisasinya", async () => {
    const lain = await getRingkasanKos(db, "org_lain");
    assert.equal(lain?.kamar.total, 1);
    assert.equal(lain?.kamar.daftar[0].namaPenghuni, "Penghuni Kos Lain");
    const melati = await getRingkasanKos(db, "org_kos_melati");
    assert.ok(melati?.kamar.daftar.every((k) => k.namaPenghuni !== "Penghuni Kos Lain"));
  });

  it("kamar nonaktif tidak dihitung; kos tanpa kamar → persen 0, bukan NaN", async () => {
    await ubahKamar(db, "org_kos_melati", "room_C10", { aktif: false });
    const { kamar } = (await getRingkasanKos(db, "org_kos_melati"))!;
    assert.deepEqual(
      [kamar.total, kamar.kosong, kamar.nonaktif, kamar.persenTerisi, kamar.potensiSewaKosong],
      [39, 5, 1, 87, 3_100_000],
    );
    await ubahKamar(db, "org_kos_melati", "room_C10", { aktif: true });

    await db.insert(schema.users).values({ id: "usr_kosong", nama: "Owner Kosong", nomorWa: "6280000000009" });
    await db.insert(schema.organizations).values({ id: "org_kosong", namaKos: "Kos Kosong", jumlahKamar: 0, ownerId: "usr_kosong" });
    const kosong = (await getRingkasanKos(db, "org_kosong"))!.kamar;
    assert.deepEqual([kosong.total, kosong.persenTerisi, kosong.potensiSewaKosong], [0, 0, 0]);
  });

  it("organisasi tidak dikenal → null", async () => {
    assert.equal(await getRingkasanKos(db, "org_tidak_ada"), null);
  });
});
