import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { eq } from "drizzle-orm";

import type { Db } from "../../db/index.ts";
import * as schema from "../../db/schema.ts";
import { isiDataContoh } from "../../db/seed.ts";
import { buatDbUji } from "../../db/testing.ts";
import { getPerluReview } from "./perlu-review.ts";

describe("getPerluReview", () => {
  let db: Db;
  let tutup: () => Promise<void>;

  before(async () => {
    ({ db, tutup } = await buatDbUji());
    await isiDataContoh(db);
  });
  after(() => tutup());

  it("tagihan perlu review beserta uang yang sudah diterima", async () => {
    assert.deepEqual(await getPerluReview(db, "org_kos_melati"), [
      {
        invoiceId: "inv_2026-09_C09",
        nomorKamar: "C09",
        namaPenghuni: "Grace Natalia",
        periode: "2026-09",
        nominal: 800_000,
        dibayar: 750_000,
      },
    ]);
  });

  it("beberapa tagihan urut periode & kamar; pembayaran pending tidak dihitung", async () => {
    await db
      .update(schema.invoices)
      .set({ status: "perlu_review" })
      .where(eq(schema.invoices.id, "inv_2026-09_A03"));
    await db.insert(schema.payments).values({
      invoiceId: "inv_2026-09_A03",
      nominalDibayar: 500_000,
      metode: "VA BCA",
      provider: "xendit",
      referensiProvider: "uji-pending-review",
      status: "pending",
    });
    const hasil = await getPerluReview(db, "org_kos_melati");
    assert.deepEqual(hasil.map((r) => [r.nomorKamar, r.dibayar]), [["A03", 0], ["C09", 750_000]]);
  });

  it("organisasi lain tidak melihatnya", async () => {
    assert.deepEqual(await getPerluReview(db, "org_lain"), []);
  });
});
