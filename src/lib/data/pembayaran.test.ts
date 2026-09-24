import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import type { Db } from "../../db/index.ts";
import * as schema from "../../db/schema.ts";
import { isiDataContoh } from "../../db/seed.ts";
import { buatDbUji } from "../../db/testing.ts";
import { getDaftarTagihanPembayaran } from "./pembayaran.ts";

describe("getDaftarTagihanPembayaran", () => {
  let db: Db;
  let tutup: () => Promise<void>;

  before(async () => {
    ({ db, tutup } = await buatDbUji());
    await isiDataContoh(db);
    // Pembayaran pending (belum diverifikasi) untuk A03 — belum dihitung dibayar.
    await db.insert(schema.payments).values({
      invoiceId: "inv_2026-09_A03",
      nominalDibayar: 500_000,
      metode: "VA BCA",
      provider: "midtrans",
      referensiProvider: "uji-pending",
      status: "pending",
    });
  });
  after(() => tutup());

  const cari = async (kamar: string) =>
    (await getDaftarTagihanPembayaran(db, "org_kos_melati", { periode: "2026-09" })).find(
      (t) => t.nomorKamar === kamar,
    )!;

  it("tagihan lunas: dibayar = nominal, pembayaran terakhir valid", async () => {
    const b12 = await cari("B12");
    assert.equal(b12.dibayar, 650_000);
    assert.equal(b12.pembayaranTerakhir?.status, "valid");
    assert.equal(b12.pembayaranTerakhir?.metode, "QRIS");
  });

  it("perlu review: dibayar kurang dari tagihan", async () => {
    const c09 = await cari("C09");
    assert.equal(c09.status, "perlu_review");
    assert.equal(c09.nominal, 800_000);
    assert.equal(c09.dibayar, 750_000);
    assert.equal(c09.pembayaranTerakhir?.status, "tidak_cocok");
    assert.equal(c09.pembayaranTerakhir?.waktu, "2026-09-23T12:42:00.000Z");
  });

  it("pembayaran pending belum dihitung", async () => {
    const a03 = await cari("A03");
    assert.equal(a03.dibayar, 0);
    assert.equal(a03.pembayaranTerakhir, undefined);
  });

  it("periode tanpa tagihan → kosong", async () => {
    assert.deepEqual(await getDaftarTagihanPembayaran(db, "org_kos_melati", { periode: "2026-12" }), []);
  });
});
