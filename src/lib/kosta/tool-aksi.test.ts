import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { and, eq } from "drizzle-orm";

import type { Db } from "../../db/index.ts";
import * as schema from "../../db/schema.ts";
import { isiDataContoh } from "../../db/seed.ts";
import { buatDbUji } from "../../db/testing.ts";
import { toolDraftTagihan } from "./tool-aksi.ts";

const ORG = "org_kos_melati";
const PEMILIK = { organizationId: ORG, userId: "usr_ratna", conversationId: "wac_owner_kos_melati" };
const HARI_INI = "2026-09-24";

describe("toolDraftTagihan", () => {
  let db: Db;
  let tutup: () => Promise<void>;
  const jumlahInvoice = async (periode: string) =>
    (await db.select().from(schema.invoices).where(and(eq(schema.invoices.organizationId, ORG), eq(schema.invoices.periode, periode)))).length;

  before(async () => {
    ({ db, tutup } = await buatDbUji());
    await isiDataContoh(db);
  });
  after(() => tutup());

  it("periode yang disebut dan sudah ditagih semua → tidak ada draft", async () => {
    assert.deepEqual(await toolDraftTagihan(db, PEMILIK, { periode: "2026-09", hariIni: HARI_INI }), {
      teks: "Semua penghuni aktif sudah punya tagihan September 2026. Tidak ada draft yang perlu dibuat.",
    });
  });

  it("bulan berjalan sudah ditagih semua → draft bulan depan, menunggu konfirmasi, belum ada tagihan dibuat", async () => {
    const hasil = await toolDraftTagihan(db, PEMILIK, { hariIni: HARI_INI });
    assert.equal(
      hasil.teks,
      "Ini draft tagihan Oktober 2026 untuk 34 penghuni, total Rp22.100.000. Belum ada tagihan yang dibuat sampai kamu konfirmasi.",
    );
    assert.ok(hasil.lampiran?.jenis === "preview_aksi");
    assert.equal(hasil.lampiran.status, "menunggu_konfirmasi");
    assert.equal(hasil.lampiran.aksi, "tagihan");
    assert.ok(hasil.lampiran.draftId);
    assert.equal(await jumlahInvoice("2026-10"), 0);
  });

  it("penghuni baru bulan ini yang belum ditagih → draft bulan berjalan", async () => {
    await db.insert(schema.tenants).values({
      id: "tnt_baru",
      organizationId: ORG,
      nama: "Penghuni Baru",
      nomorWa: "6281300000077",
      roomId: "room_A07",
      tanggalMasuk: "2026-09-20",
      hargaSewa: 500_000,
    });
    const hasil = await toolDraftTagihan(db, PEMILIK, { hariIni: HARI_INI });
    assert.ok(hasil.lampiran?.jenis === "preview_aksi");
    assert.deepEqual([hasil.lampiran.periode, hasil.lampiran.penerima], ["2026-09", [{ nomorKamar: "A07", nama: "Penghuni Baru", nominal: 500_000 }]]);
  });

  it("preview baru menggantikan preview lama yang belum diputuskan di percakapan yang sama", async () => {
    const menunggu = await db
      .select({ id: schema.actionDrafts.id })
      .from(schema.actionDrafts)
      .where(and(eq(schema.actionDrafts.conversationId, PEMILIK.conversationId), eq(schema.actionDrafts.status, "menunggu_konfirmasi")));
    assert.equal(menunggu.length, 1);
  });
});
