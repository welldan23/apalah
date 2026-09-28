import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { and, eq, isNull } from "drizzle-orm";

import { tambahPenghuni } from "../lib/aksi/penghuni.ts";
import type { Db } from "./index.ts";
import * as schema from "./schema.ts";
import { isiDataContoh } from "./seed.ts";
import { buatDbUji } from "./testing.ts";

const ORG = "org_kos_melati";

describe("skema kamar & penghuni: riwayat hunian", () => {
  let db: Db;
  let tutup: () => Promise<void>;

  const ditolakOleh = (query: Promise<unknown>, constraint: string) =>
    assert.rejects(query, (err: Error & { cause?: Error }) => {
      assert.match(err.cause?.message ?? err.message, new RegExp(constraint));
      return true;
    });

  before(async () => {
    ({ db, tutup } = await buatDbUji());
    await isiDataContoh(db);
  });
  after(() => tutup());

  it("data contoh: satu hunian per penghuni; 34 masih berjalan, 2 selesai karena keluar", async () => {
    const semua = await db.select().from(schema.riwayatHunian);
    assert.equal(semua.length, 36);
    assert.equal(semua.filter((h) => h.tanggalSelesai === null).length, 34);
    const rudi = semua.find((h) => h.tenantId === "tnt_keluar_A07");
    assert.deepEqual([rudi?.roomId, rudi?.tanggalSelesai, rudi?.alasanSelesai], ["room_A07", "2026-06-30", "keluar"]);
  });

  it("penghuni keluar wajib bertanggal, tanggal keluar tidak sebelum tanggal masuk", async () => {
    await ditolakOleh(
      db.update(schema.tenants).set({ status: "keluar" }).where(eq(schema.tenants.id, "tnt_A01")),
      "tenants_keluar_bertanggal",
    );
    await ditolakOleh(
      db.update(schema.tenants).set({ tanggalKeluar: "2020-01-01" }).where(eq(schema.tenants.id, "tnt_A01")),
      "tenants_tanggal_keluar_urut",
    );
  });

  it("satu penghuni hanya punya satu hunian berjalan", async () => {
    await ditolakOleh(
      db.insert(schema.riwayatHunian).values({
        organizationId: ORG,
        tenantId: "tnt_A01",
        roomId: "room_A11",
        tanggalMulai: "2026-09-24",
        hargaSewa: 500_000,
      }),
      "riwayat_hunian_berjalan_unik",
    );
  });

  it("tambah penghuni ikut mencatat hunian berjalan", async () => {
    const { tenantId } = await tambahPenghuni(db, ORG, {
      nama: "Sari Baru",
      nomorWa: "6281300000099",
      roomId: "room_A11",
      tanggalMasuk: "2026-09-24",
      hargaSewa: 500_000,
    });
    const hunian = await db
      .select()
      .from(schema.riwayatHunian)
      .where(and(eq(schema.riwayatHunian.tenantId, tenantId), isNull(schema.riwayatHunian.tanggalSelesai)));
    assert.deepEqual(hunian.map((h) => [h.roomId, h.tanggalMulai, h.hargaSewa]), [["room_A11", "2026-09-24", 500_000]]);
  });
});
