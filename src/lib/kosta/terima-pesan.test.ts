import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { eq } from "drizzle-orm";

import type { Db } from "../../db/index.ts";
import * as schema from "../../db/schema.ts";
import { isiDataContoh } from "../../db/seed.ts";
import { buatDbUji } from "../../db/testing.ts";
import { simpanPesanMasuk } from "./terima-pesan.ts";

describe("simpanPesanMasuk", () => {
  let db: Db;
  let tutup: () => Promise<void>;

  before(async () => {
    ({ db, tutup } = await buatDbUji());
    await isiDataContoh(db);
  });
  after(() => tutup());

  const pesan = (idProvider: string, dari: string, waktu: string, teks = "Berapa tunggakan bulan ini?") => ({
    idProvider,
    dari,
    teks,
    waktu: new Date(waktu),
  });

  it("pesan owner masuk ke percakapannya, membawa pengguna & kos aktif", async () => {
    const [baru] = await simpanPesanMasuk(db, [pesan("wamid.A", "6281234567890", "2026-09-25T08:00:00+07:00")]);
    assert.equal(baru.conversationId, "wac_owner_kos_melati");
    assert.equal(baru.userId, "usr_ratna");
    assert.equal(baru.organizationId, "org_kos_melati");

    const [simpan] = await db.select().from(schema.waMessages).where(eq(schema.waMessages.id, baru.messageId));
    assert.deepEqual([simpan.arah, simpan.isi, simpan.organizationId], ["masuk", "Berapa tunggakan bulan ini?", "org_kos_melati"]);
    const [wac] = await db.select().from(schema.waConversations).where(eq(schema.waConversations.id, baru.conversationId));
    assert.equal(wac.terakhirPesanPada?.toISOString(), "2026-09-25T01:00:00.000Z");
  });

  it("kiriman ulang dengan ID yang sama tidak tercatat dua kali", async () => {
    assert.deepEqual(await simpanPesanMasuk(db, [pesan("wamid.A", "6281234567890", "2026-09-25T08:00:00+07:00")]), []);
    const semua = await db.select().from(schema.waMessages).where(eq(schema.waMessages.idPesanProvider, "wamid.A"));
    assert.equal(semua.length, 1);
  });

  it("nomor asing: percakapan baru tanpa pengguna maupun kos", async () => {
    const [baru] = await simpanPesanMasuk(db, [pesan("wamid.B", "6285700000001", "2026-09-25T09:00:00+07:00", "halo")]);
    assert.equal(baru.userId, null);
    assert.equal(baru.organizationId, null);
    const [simpan] = await db.select().from(schema.waMessages).where(eq(schema.waMessages.id, baru.messageId));
    assert.equal(simpan.organizationId, null);
  });

  it("pesan lama yang datang terlambat tidak memundurkan waktu pesan terakhir", async () => {
    await simpanPesanMasuk(db, [pesan("wamid.C", "6281234567890", "2026-09-25T07:00:00+07:00")]);
    const [wac] = await db.select().from(schema.waConversations).where(eq(schema.waConversations.id, "wac_owner_kos_melati"));
    assert.equal(wac.terakhirPesanPada?.toISOString(), "2026-09-25T01:00:00.000Z");
  });
});
