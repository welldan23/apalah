import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import type { Db } from "./index.ts";
import * as schema from "./schema.ts";
import { isiDataContoh } from "./seed.ts";
import { buatDbUji } from "./testing.ts";

const ORG = "org_kos_melati";
const INV = "inv_2026-09_A05";

describe("skema transaksi bayar lewat tautan (payment_attempts)", () => {
  let db: Db;
  let tutup: () => Promise<void>;
  const ditolakOleh = (query: Promise<unknown>, constraint: string) =>
    assert.rejects(query, (err: Error & { cause?: Error }) => {
      assert.match(err.cause?.message ?? err.message, new RegExp(constraint));
      return true;
    });
  const transaksi = (ubah: Partial<typeof schema.paymentAttempts.$inferInsert> = {}) => {
    const percobaan = ubah.percobaan ?? 1;
    return db.insert(schema.paymentAttempts).values({
      organizationId: ORG,
      invoiceId: INV,
      percobaan,
      orderId: `${INV}~${percobaan}`,
      metode: "qris",
      nominal: 500_000,
      qrString: "00020101021226...",
      kedaluwarsaPada: new Date(Date.now() + 15 * 60_000),
      ...ubah,
    });
  };

  before(async () => {
    ({ db, tutup } = await buatDbUji());
    await isiDataContoh(db);
  });
  after(() => tutup());

  it("QRIS & Virtual Account tersimpan; status awal menunggu", async () => {
    await transaksi();
    await transaksi({ percobaan: 2, orderId: `${INV}~2`, metode: "va_bca", qrString: null, nomorVa: "12345678901" });
    const semua = await db.select().from(schema.paymentAttempts);
    assert.deepEqual(semua.map((t) => [t.orderId, t.metode, t.status]), [
      [`${INV}~1`, "qris", "menunggu"],
      [`${INV}~2`, "va_bca", "menunggu"],
    ]);
  });

  it("order_id harus <invoiceId>~<percobaan>, unik per tagihan & percobaan", async () => {
    await ditolakOleh(transaksi({ percobaan: 3, orderId: `${INV}~9` }), "payment_attempts_order_id");
    await ditolakOleh(transaksi({ percobaan: 1 }), "payment_attempts_order_unik|payment_attempts_invoice_percobaan_unik");
    await ditolakOleh(transaksi({ percobaan: 0, orderId: `${INV}~0` }), "payment_attempts_percobaan_positif");
  });

  it("QRIS wajib membawa isi QR, VA wajib nomor VA; nominal positif", async () => {
    await ditolakOleh(transaksi({ percobaan: 4, orderId: `${INV}~4`, qrString: null }), "payment_attempts_instruksi");
    await ditolakOleh(transaksi({ percobaan: 5, orderId: `${INV}~5`, metode: "va_bni", qrString: null }), "payment_attempts_instruksi");
    await ditolakOleh(transaksi({ percobaan: 6, orderId: `${INV}~6`, metode: "vax_bni", qrString: null, nomorVa: "1" }), "payment_attempts_instruksi");
    await ditolakOleh(transaksi({ percobaan: 7, orderId: `${INV}~7`, nominal: 0 }), "payment_attempts_nominal_positif");
  });
});
