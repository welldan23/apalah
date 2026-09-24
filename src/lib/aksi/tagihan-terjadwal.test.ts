import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { sql } from "drizzle-orm";

import type { Db } from "../../db/index.ts";
import * as schema from "../../db/schema.ts";
import { isiDataContoh } from "../../db/seed.ts";
import { buatDbUji } from "../../db/testing.ts";
import { PENGATURAN_BAWAAN } from "../tagihan-terjadwal.ts";
import { GalatAksi } from "./galat.ts";
import {
  bacaInputPengaturan,
  getPengaturanTagihanTerjadwal,
  simpanPengaturanTagihanTerjadwal,
} from "./tagihan-terjadwal.ts";

const ORG = "org_kos_melati";

describe("pengaturan tagihan terjadwal", () => {
  let db: Db;
  let tutup: () => Promise<void>;

  before(async () => {
    ({ db, tutup } = await buatDbUji());
    await isiDataContoh(db);
    await db.insert(schema.users).values({ id: "usr_lain", nama: "Owner Lain", nomorWa: "6280000000001" });
    await db.insert(schema.organizations).values({ id: "org_lain", namaKos: "Kos Lain", jumlahKamar: 1, ownerId: "usr_lain" });
  });
  after(() => tutup());

  it("kos yang belum menyimpan memakai pengaturan bawaan (nonaktif)", async () => {
    assert.deepEqual(await getPengaturanTagihanTerjadwal(db, ORG), PENGATURAN_BAWAAN);
  });

  it("menyimpan lalu menimpa pengaturan — tetap satu baris per kos", async () => {
    const tetap = { aktif: true, tanggalTerbit: 1, jatuhTempo: { aturan: "tanggal_tetap", tanggal: 10 } } as const;
    assert.deepEqual(await simpanPengaturanTagihanTerjadwal(db, ORG, tetap), tetap);

    const masuk = { aktif: false, tanggalTerbit: 25, jatuhTempo: { aturan: "tanggal_masuk" } } as const;
    assert.deepEqual(await simpanPengaturanTagihanTerjadwal(db, ORG, masuk), masuk);

    const baris = await db.select().from(schema.invoiceSchedules);
    assert.equal(baris.length, 1);
    assert.equal(baris[0].tanggalJatuhTempo, null);
  });

  it("pengaturan satu kos tidak memengaruhi kos lain", async () => {
    assert.deepEqual(await getPengaturanTagihanTerjadwal(db, "org_lain"), PENGATURAN_BAWAAN);
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.invoiceSchedules)
      .where(sql`${schema.invoiceSchedules.organizationId} = 'org_lain'`);
    assert.equal(n, 0);
  });

  it("validasi input", () => {
    const benar = { aktif: true, tanggalTerbit: 1, jatuhTempo: { aturan: "tanggal_masuk" } };
    assert.deepEqual(bacaInputPengaturan(benar), benar);
    assert.deepEqual(
      bacaInputPengaturan({ ...benar, jatuhTempo: { aturan: "tanggal_tetap", tanggal: 5, lain: 1 } }),
      { ...benar, jatuhTempo: { aturan: "tanggal_tetap", tanggal: 5 } },
    );
    for (const salah of [
      { ...benar, aktif: "ya" },
      { ...benar, tanggalTerbit: 0 },
      { ...benar, tanggalTerbit: 29 },
      { ...benar, tanggalTerbit: 1.5 },
      { ...benar, jatuhTempo: null },
      { ...benar, jatuhTempo: { aturan: "tiap_minggu" } },
      { ...benar, jatuhTempo: { aturan: "tanggal_tetap" } },
      { ...benar, jatuhTempo: { aturan: "tanggal_tetap", tanggal: 31 } },
    ]) {
      assert.throws(() => bacaInputPengaturan(salah), GalatAksi, JSON.stringify(salah));
    }
  });
});
