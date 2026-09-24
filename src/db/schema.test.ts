import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { eq, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

import type { Db } from "./index.ts";
import * as schema from "./schema.ts";
import { isiDataContoh } from "./seed.ts";
import { buatDbUji } from "./testing.ts";

describe("skema & migrasi dashboard", () => {
  let db: Db;
  let tutup: () => Promise<void>;

  before(async () => {
    ({ db, tutup } = await buatDbUji());
    await isiDataContoh(db);
  });
  after(() => tutup());

  const hitung = async (tabel: PgTable) => {
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(tabel);
    return n;
  };

  it("data contoh Kos Melati sesuai angka PRD", async () => {
    assert.equal(await hitung(schema.organizations), 1);
    assert.equal(await hitung(schema.rooms), 40);
    // 34 penghuni aktif + 2 mantan penghuni.
    assert.equal(await hitung(schema.tenants), 36);
    assert.equal(await hitung(schema.invoices), 34);

    const [{ total }] = await db
      .select({ total: sql<number>`sum(${schema.payments.nominalDibayar})::int` })
      .from(schema.payments)
      .where(eq(schema.payments.status, "valid"));
    assert.equal(total, 12_500_000);

    const jatuhTempo = await db
      .select()
      .from(schema.invoices)
      .where(eq(schema.invoices.status, "jatuh_tempo"));
    assert.equal(jatuhTempo.length, 3);
  });

  it("seed aman diulang", async () => {
    assert.equal(await isiDataContoh(db), false);
    assert.equal(await hitung(schema.invoices), 34);
  });

  describe("constraint menolak data tidak valid", () => {
    /** Pastikan penolakan datang dari constraint yang dimaksud, bukan error lain. */
    const ditolakOleh = (query: Promise<unknown>, constraint: string) =>
      assert.rejects(query, (err: Error & { cause?: Error }) => {
        assert.match(err.cause?.message ?? err.message, new RegExp(constraint));
        return true;
      });

    const invoiceDasar = async () => {
      const [inv] = await db.select().from(schema.invoices).limit(1);
      return { ...inv, id: crypto.randomUUID(), tokenPublik: `uji-${crypto.randomUUID()}` };
    };

    it("nominal invoice harus positif", async () => {
      await ditolakOleh(
        db.insert(schema.invoices).values({ ...(await invoiceDasar()), nominal: 0 }),
        "invoices_nominal_positif",
      );
    });

    it("periode harus format YYYY-MM", async () => {
      await ditolakOleh(
        db.insert(schema.invoices).values({ ...(await invoiceDasar()), periode: "2026-13" }),
        "invoices_format_periode",
      );
    });

    it("token publik invoice unik", async () => {
      const [inv] = await db.select().from(schema.invoices).limit(1);
      await ditolakOleh(
        db.insert(schema.invoices).values({ ...(await invoiceDasar()), tokenPublik: inv.tokenPublik }),
        "invoices_token_publik_unik",
      );
    });

    it("satu kamar hanya satu penghuni aktif", async () => {
      const [t] = await db.select().from(schema.tenants).limit(1);
      await ditolakOleh(
        db.insert(schema.tenants).values({ ...t, id: crypto.randomUUID(), nama: "Penghuni Kedua" }),
        "tenants_kamar_aktif_unik",
      );
    });

    it("nomor kamar unik per kos", async () => {
      const [r] = await db.select().from(schema.rooms).limit(1);
      await ditolakOleh(
        db.insert(schema.rooms).values({ ...r, id: crypto.randomUUID() }),
        "rooms_organisasi_nomor_unik",
      );
    });
  });
});
