import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { eq, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

import type { Db } from "./index.ts";
import * as schema from "./schema.ts";
import { isiDataContoh } from "./seed.ts";
import { buatDbUji } from "./testing.ts";

describe("skema & migrasi", () => {
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
    // Kos Melati + 2 kos lain untuk pemilih workspace (tanpa kamar).
    assert.equal(await hitung(schema.organizations), 3);
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

  it("tiap invoice contoh punya rincian yang totalnya sama dengan nominal", async () => {
    const selisih = await db
      .select({ id: schema.invoices.id })
      .from(schema.invoices)
      .leftJoin(schema.invoiceItems, eq(schema.invoiceItems.invoiceId, schema.invoices.id))
      .groupBy(schema.invoices.id, schema.invoices.nominal)
      .having(sql`coalesce(sum(${schema.invoiceItems.nominal}), 0) <> ${schema.invoices.nominal}`);
    assert.deepEqual(selisih, []);
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

    it("nominal rincian invoice harus positif", async () => {
      const [inv] = await db.select().from(schema.invoices).limit(1);
      await ditolakOleh(
        db.insert(schema.invoiceItems).values({ invoiceId: inv.id, label: "Diskon", nominal: -50_000 }),
        "invoice_items_nominal_positif",
      );
    });

    it("tagihan terjadwal: tanggal terbit 1–28", async () => {
      await ditolakOleh(
        db.insert(schema.invoiceSchedules).values({ organizationId: "org_kos_melati", tanggalTerbit: 31 }),
        "invoice_schedules_tanggal_terbit",
      );
    });

    it("tagihan terjadwal: tanggal jatuh tempo hanya & wajib untuk aturan tanggal tetap", async () => {
      await ditolakOleh(
        db.insert(schema.invoiceSchedules).values({ organizationId: "org_kos_melati", aturanJatuhTempo: "tanggal_tetap" }),
        "invoice_schedules_tanggal_jatuh_tempo",
      );
      await ditolakOleh(
        db.insert(schema.invoiceSchedules).values({ organizationId: "org_kos_melati", tanggalJatuhTempo: 10 }),
        "invoice_schedules_tanggal_jatuh_tempo",
      );
    });

    it("tagihan terjadwal: satu pengaturan per kos", async () => {
      await db.insert(schema.invoiceSchedules).values({
        organizationId: "org_kos_melati",
        aturanJatuhTempo: "tanggal_tetap",
        tanggalJatuhTempo: 10,
      });
      await ditolakOleh(
        db.insert(schema.invoiceSchedules).values({ organizationId: "org_kos_melati" }),
        "invoice_schedules_organisasi_unik",
      );
    });

    it("webhook event unik per provider; satu event hanya mencatat satu pembayaran", async () => {
      const event = { provider: "xendit", eventId: "evt-uji-1", payload: { order_id: "x" } };
      const [e] = await db.insert(schema.webhookEvents).values(event).returning();
      await ditolakOleh(db.insert(schema.webhookEvents).values(event), "webhook_events_provider_event_unik");
      // Provider lain boleh memakai event_id yang sama.
      await db.insert(schema.webhookEvents).values({ ...event, provider: "simulasi" });

      const [inv] = await db.select().from(schema.invoices).limit(1);
      const bayar = { invoiceId: inv.id, nominalDibayar: 1, metode: "QRIS", provider: "xendit", webhookEventId: e.id };
      await db.insert(schema.payments).values({ ...bayar, referensiProvider: "uji-evt-1" });
      await ditolakOleh(
        db.insert(schema.payments).values({ ...bayar, referensiProvider: "uji-evt-2" }),
        "payments_webhook_event_unik",
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
