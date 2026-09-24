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
  });

  it("invoice lunas membawa tanggal bayar", async () => {
    const inv = await getInvoicePublik(db, "demo-a01-2026-09");
    assert.equal(inv?.status, "lunas");
    assert.equal(inv?.dibayarPada, "2026-09-02");
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
