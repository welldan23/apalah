import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { and, eq } from "drizzle-orm";

import type { Db } from "../../db/index.ts";
import * as schema from "../../db/schema.ts";
import { isiDataContoh } from "../../db/seed.ts";
import { buatDbUji } from "../../db/testing.ts";
import { buatTagihan, buatTokenPublik } from "../aksi/tagihan.ts";
import { getInvoicePublik, tokenValid } from "./invoice-publik.ts";

describe("getInvoicePublik", () => {
  let db: Db;
  let tutup: () => Promise<void>;

  before(async () => {
    ({ db, tutup } = await buatDbUji());
    await isiDataContoh(db);
  });
  after(() => tutup());

  it("mengembalikan data satu invoice berdasarkan token", async () => {
    const inv = await getInvoicePublik(db, "demo-b06-2026-09");
    assert.deepEqual(inv, {
      nomorInvoice: "INV-202609-B06",
      namaKos: "Kos Melati",
      alamatKos: "Jl. Melati No. 12, Condongcatur, Sleman",
      nomorWaPemilik: "6281234567890",
      namaPenghuni: "Reza Kurniawan",
      nomorKamar: "B06",
      tipeKamar: "KM Dalam",
      periode: "2026-09",
      nominal: 650_000,
      rincian: [{ label: "Sewa kamar", nominal: 650_000 }],
      jatuhTempo: "2026-09-18",
      status: "jatuh_tempo",
      diterbitkanPada: "2026-09-11",
      dibayarPada: undefined,
      pembayaran: [],
      sudahDiterima: 0,
      sisa: 650_000,
      bisaDibayar: true,
    });
  });

  it("rincian: sewa kamar di atas, lalu biaya tambahan", async () => {
    await buatTagihan(db, "org_kos_melati", {
      periode: "2026-10",
      jatuhTempo: "2026-10-03",
      roomIds: ["room_A01"],
      biayaTambahan: [
        { label: "Listrik", nominal: 75_000 },
        { label: "Air", nominal: 25_000 },
      ],
    });
    const [{ token }] = await db
      .select({ token: schema.invoices.tokenPublik })
      .from(schema.invoices)
      .where(and(eq(schema.invoices.roomId, "room_A01"), eq(schema.invoices.periode, "2026-10")));
    const inv = await getInvoicePublik(db, token);
    assert.equal(inv?.nominal, 600_000);
    assert.deepEqual(inv?.rincian, [
      { label: "Sewa kamar", nominal: 500_000 },
      { label: "Air", nominal: 25_000 },
      { label: "Listrik", nominal: 75_000 },
    ]);
    assert.deepEqual([inv?.status, inv?.sisa, inv?.bisaDibayar], ["menunggu", 600_000, true]);

    // Draf dari Kosta belum dikirim ke penyewa dan nominalnya masih bisa dikoreksi → belum bisa dibayar.
    await db.update(schema.invoices).set({ status: "draft" }).where(eq(schema.invoices.tokenPublik, token));
    const draf = await getInvoicePublik(db, token);
    assert.deepEqual([draf?.status, draf?.sisa, draf?.bisaDibayar], ["draft", 600_000, false]);
  });

  it("invoice lunas membawa tanggal bayar", async () => {
    const inv = await getInvoicePublik(db, "demo-a01-2026-09");
    assert.equal(inv?.status, "lunas");
    assert.equal(inv?.dibayarPada, "2026-09-02");
  });

  it("riwayat pembayaran & uang yang sudah masuk (yang diproses gateway belum dihitung)", async () => {
    const lunas = await getInvoicePublik(db, "demo-a01-2026-09");
    assert.ok(lunas);
    assert.deepEqual(
      lunas.pembayaran.map((p) => [p.nominal, p.status]),
      [[lunas.nominal, "valid"]],
    );
    assert.equal(lunas.sudahDiterima, lunas.nominal);
    assert.deepEqual([lunas.sisa, lunas.bisaDibayar], [0, false]);

    // Grace (C09) membayar Rp750.000 untuk tagihan Rp800.000 → diperiksa pemilik kos.
    const kurang = await getInvoicePublik(db, "demo-c09-2026-09");
    assert.deepEqual(kurang?.pembayaran, [{ waktu: "2026-09-23T12:42:00.000Z", metode: "QRIS", nominal: 750_000, status: "tidak_cocok" }]);
    assert.deepEqual([kurang?.nominal, kurang?.sudahDiterima], [800_000, 750_000]);
    // Perlu review karena kurang bayar: sisanya tetap bisa dibayar.
    assert.deepEqual([kurang?.status, kurang?.sisa, kurang?.bisaDibayar], ["perlu_review", 50_000, true]);

    await db.insert(schema.payments).values({
      invoiceId: "inv_2026-09_C09",
      nominalDibayar: 50_000,
      metode: "VA BCA",
      provider: "midtrans",
      referensiProvider: "uji-pending-c09",
      status: "pending",
    });
    const denganPending = await getInvoicePublik(db, "demo-c09-2026-09");
    assert.deepEqual(denganPending?.pembayaran.map((p) => p.status), ["tidak_cocok", "pending"]);
    assert.equal(denganPending?.sudahDiterima, 750_000);
    assert.equal(denganPending?.sisa, 50_000);

    const belum = await getInvoicePublik(db, "demo-a05-2026-09");
    assert.deepEqual([belum?.pembayaran, belum?.sudahDiterima], [[], 0]);
  });

  it("lebih bayar: sisa 0 dan tidak bisa dibayar lagi walau masih diperiksa", async () => {
    await db.insert(schema.payments).values({
      invoiceId: "inv_2026-09_C09",
      nominalDibayar: 100_000,
      metode: "VA BNI",
      provider: "midtrans",
      referensiProvider: "uji-lebih-c09",
      status: "tidak_cocok",
    });
    const inv = await getInvoicePublik(db, "demo-c09-2026-09");
    assert.deepEqual([inv?.status, inv?.sudahDiterima, inv?.sisa, inv?.bisaDibayar], ["perlu_review", 850_000, 0, false]);
  });

  it("token baru acak, unik, dan lolos validasi format", () => {
    const token = Array.from({ length: 200 }, buatTokenPublik);
    assert.equal(new Set(token).size, 200);
    assert.ok(token.every((t) => t.length === 24 && tokenValid(t)));
  });

  it("token tidak dikenal atau formatnya salah → null", async () => {
    assert.equal(await getInvoicePublik(db, "demo-z99-2026-09"), null);
    assert.equal(await getInvoicePublik(db, "' or 1=1 --"), null);
    assert.equal(tokenValid("pendek"), false);
    assert.equal(tokenValid("x".repeat(65)), false);
  });
});
