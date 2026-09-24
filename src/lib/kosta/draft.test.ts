import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { and, eq } from "drizzle-orm";

import type { Db } from "../../db/index.ts";
import * as schema from "../../db/schema.ts";
import { isiDataContoh } from "../../db/seed.ts";
import { buatDbUji } from "../../db/testing.ts";
import { GalatAksi } from "../aksi/galat.ts";
import type { PengirimWhatsApp, PesanWhatsApp } from "../whatsapp/index.ts";
import { draftMenungguTerakhir, putuskanDraft, siapkanDraftReminder, siapkanDraftTagihan } from "./draft.ts";
import { catatPesan, getPercakapanPengguna } from "./riwayat.ts";

const ORG = "org_kos_melati";
const PEMILIK = { organizationId: ORG, userId: "usr_ratna", conversationId: "wac_owner_kos_melati" };
const DRAFT_CONTOH = "draft_reminder_2026-09";

describe("alur preview → konfirmasi aksi Kosta", () => {
  let db: Db;
  let tutup: () => Promise<void>;
  const terkirim: PesanWhatsApp[] = [];
  const wa: PengirimWhatsApp = {
    provider: "uji",
    simulasi: false,
    async kirim(pesan) {
      terkirim.push(pesan);
      return { ok: true };
    },
  };
  const deps = { wa, baseUrl: "https://kostera.id" };
  const statusDraft = async (id: string) =>
    (await db.select({ s: schema.actionDrafts.status }).from(schema.actionDrafts).where(eq(schema.actionDrafts.id, id)))[0].s;

  before(async () => {
    ({ db, tutup } = await buatDbUji());
    await isiDataContoh(db);
  });
  after(() => tutup());

  it("draft contoh disetujui → pengingat terkirim ke 3 penunggak, status dijalankan", async () => {
    assert.equal(await draftMenungguTerakhir(db, PEMILIK.conversationId, ORG), DRAFT_CONTOH);
    const hasil = await putuskanDraft(db, { draftId: DRAFT_CONTOH, organizationId: ORG, keputusan: "setuju" }, deps);
    assert.deepEqual(hasil, {
      aksi: "reminder",
      conversationId: PEMILIK.conversationId,
      status: "dijalankan",
      balasan: "Pengingat terkirim ke 3 penyewa.",
    });
    assert.equal(terkirim.length, 3);
    assert.equal(await statusDraft(DRAFT_CONTOH), "dijalankan");
    assert.equal(await draftMenungguTerakhir(db, PEMILIK.conversationId, ORG), null);
  });

  it("konfirmasi ganda ditolak; draft kos lain tidak ditemukan", async () => {
    await assert.rejects(
      putuskanDraft(db, { draftId: DRAFT_CONTOH, organizationId: ORG, keputusan: "setuju" }, deps),
      (err) => err instanceof GalatAksi && err.status === 409,
    );
    await assert.rejects(
      putuskanDraft(db, { draftId: DRAFT_CONTOH, organizationId: "org_kos_mawar", keputusan: "batal" }, deps),
      (err) => err instanceof GalatAksi && err.status === 404,
    );
    assert.equal(terkirim.length, 3);
  });

  it("preview reminder dari database; yang sudah bayar sebelum konfirmasi dilewati", async () => {
    const preview = await siapkanDraftReminder(db, PEMILIK);
    assert.ok(preview?.draftId);
    assert.deepEqual(
      { aksi: preview.aksi, periode: preview.periode, total: preview.total, kamar: preview.penerima.map((p) => p.nomorKamar) },
      { aksi: "reminder", periode: "2026-09", total: 1_950_000, kamar: ["A05", "B06", "C05"] },
    );
    assert.equal(preview.status, "menunggu_konfirmasi");

    await db.update(schema.invoices).set({ status: "lunas" }).where(eq(schema.invoices.id, "inv_2026-09_A05"));
    const hasil = await putuskanDraft(db, { draftId: preview.draftId, organizationId: ORG, keputusan: "setuju" }, deps);
    assert.equal(hasil.balasan, "Pengingat terkirim ke 2 penyewa. 1 tagihan dilewati karena sudah dibayar.");
  });

  it("batal → tidak ada yang dikirim", async () => {
    const preview = await siapkanDraftReminder(db, PEMILIK);
    const sebelum = terkirim.length;
    const hasil = await putuskanDraft(db, { draftId: preview!.draftId!, organizationId: ORG, keputusan: "batal" }, deps);
    assert.equal(hasil.status, "dibatalkan");
    assert.equal(terkirim.length, sebelum);
    const [draft] = await db.select().from(schema.actionDrafts).where(eq(schema.actionDrafts.id, preview!.draftId!));
    assert.ok(draft.dikonfirmasiPada);
  });

  it("preview lebih dari 24 jam kedaluwarsa walau disetujui", async () => {
    const preview = await siapkanDraftReminder(db, PEMILIK);
    const besok = new Date(Date.now() + 25 * 60 * 60 * 1000);
    const hasil = await putuskanDraft(
      db,
      { draftId: preview!.draftId!, organizationId: ORG, keputusan: "setuju" },
      { ...deps, sekarang: besok },
    );
    assert.equal(hasil.status, "dibatalkan");
    assert.match(hasil.balasan, /lebih dari 24 jam/);
  });

  it("draft tagihan: penghuni yang belum ditagih, jatuh tempo sesuai aturan, lalu dibuat saat disetujui", async () => {
    const preview = await siapkanDraftTagihan(db, PEMILIK, "2026-10");
    assert.equal(preview?.penerima.length, 34);
    assert.equal(preview?.total, 22_100_000);
    const [draft] = await db.select().from(schema.actionDrafts).where(eq(schema.actionDrafts.id, preview!.draftId!));
    assert.equal(draft.ringkasanPreview.tagihan?.find((t) => t.roomId === "room_A05")?.jatuhTempo, "2026-10-15");

    const hasil = await putuskanDraft(db, { draftId: preview!.draftId!, organizationId: ORG, keputusan: "setuju" }, deps);
    assert.equal(hasil.balasan, "34 tagihan Oktober 2026 dibuat, total Rp22.100.000.");
    const oktober = await db
      .select()
      .from(schema.invoices)
      .where(and(eq(schema.invoices.organizationId, ORG), eq(schema.invoices.periode, "2026-10")));
    assert.equal(oktober.length, 34);
    assert.equal(await siapkanDraftTagihan(db, PEMILIK, "2026-10"), null);
  });

  it("riwayat: percakapan dari database, status preview mengikuti draft; catatPesan menambah riwayat", async () => {
    const { conversationId, pesan } = await getPercakapanPengguna(db, "6281234567890");
    assert.equal(conversationId, PEMILIK.conversationId);
    assert.equal(pesan.length, 12);
    assert.deepEqual([pesan[0].dari, pesan[1].dari], ["owner", "kosta"]);
    const preview = pesan.at(-1)?.lampiran;
    assert.ok(preview?.jenis === "preview_aksi");
    assert.equal(preview.status, "dijalankan");

    const baru = await catatPesan(db, { conversationId: PEMILIK.conversationId, organizationId: ORG, arah: "keluar", isi: "Siap." });
    assert.equal(baru.dari, "kosta");
    assert.equal((await getPercakapanPengguna(db, "6281234567890")).pesan.at(-1)?.teks, "Siap.");
    assert.deepEqual(await getPercakapanPengguna(db, "6289999999999"), { conversationId: null, organizationId: null, pesan: [] });
  });
});
