import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import type { Db } from "../../db/index.ts";
import * as schema from "../../db/schema.ts";
import { isiDataContoh } from "../../db/seed.ts";
import { buatDbUji } from "../../db/testing.ts";
import { getDaftarKamarPenghuni } from "./kamar.ts";

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
    assert.equal(a07.penghuni, undefined);
  });
});
