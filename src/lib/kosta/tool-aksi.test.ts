import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { and, eq } from "drizzle-orm";

import type { Db } from "../../db/index.ts";
import * as schema from "../../db/schema.ts";
import { isiDataContoh } from "../../db/seed.ts";
import { buatDbUji } from "../../db/testing.ts";
import { GalatAksi } from "../aksi/galat.ts";
import { siapkanDraftReminder } from "./draft.ts";
import { toolBatalDraft, toolDraftTagihan, toolKoreksiDraft, toolSiapkanReminder } from "./tool-aksi.ts";

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

describe("koreksi & batal draft", () => {
  let db: Db;
  let tutup: () => Promise<void>;
  const percakapan = { organizationId: ORG, conversationId: PEMILIK.conversationId };
  const draft = async (id: string) =>
    (await db.select().from(schema.actionDrafts).where(eq(schema.actionDrafts.id, id)))[0];

  before(async () => {
    ({ db, tutup } = await buatDbUji());
    await isiDataContoh(db);
    // Tutup draft pengingat contoh supaya percakapan bersih.
    await toolBatalDraft(db, percakapan);
  });
  after(() => tutup());

  it("tanpa draft menunggu → dijawab jujur", async () => {
    assert.deepEqual(await toolKoreksiDraft(db, percakapan, { kecualikan: ["A05"] }), {
      teks: "Tidak ada draft yang sedang menunggu konfirmasi.",
    });
  });

  it("koreksi menghasilkan preview baru; draft lama dibatalkan", async () => {
    const awal = await toolDraftTagihan(db, PEMILIK, { hariIni: HARI_INI });
    const idLama = awal.lampiran?.jenis === "preview_aksi" ? awal.lampiran.draftId! : "";

    const hasil = await toolKoreksiDraft(db, percakapan, {
      kecualikan: ["A05"],
      nominal: [{ nomorKamar: "B06", nominal: 600_000 }],
      tanggalJatuhTempo: 31,
    });
    assert.equal(
      hasil.teks,
      "Draft diperbarui (A05 dikecualikan; B06 jadi Rp600.000; jatuh tempo 31 Okt 2026). Sekarang 33 penghuni, total Rp21.550.000. Cek lagi lalu konfirmasi.",
    );
    assert.ok(hasil.lampiran?.jenis === "preview_aksi");
    assert.ok(hasil.lampiran.penerima.every((p) => p.nomorKamar !== "A05"));
    assert.equal((await draft(idLama)).status, "dibatalkan");

    const baru = await draft(hasil.lampiran.draftId!);
    assert.equal(baru.status, "menunggu_konfirmasi");
    assert.ok(baru.ringkasanPreview.tagihan?.every((t) => t.jatuhTempo === "2026-10-31"));
    assert.equal(baru.ringkasanPreview.tagihan?.find((t) => t.roomId === "room_B06")?.sewa, 600_000);
  });

  it("kamar yang tidak ada di draft ditolak tanpa mengubah draft", async () => {
    await assert.rejects(
      toolKoreksiDraft(db, percakapan, { kecualikan: ["A07"] }),
      (err) => err instanceof GalatAksi && /A07 tidak ada di draft/.test(err.message),
    );
  });

  it("semua kamar dikecualikan → draft dibatalkan", async () => {
    await toolBatalDraft(db, percakapan);
    await db.update(schema.tenants).set({ status: "keluar", tanggalKeluar: "2026-09-30" }).where(eq(schema.tenants.organizationId, ORG));
    await db.update(schema.tenants).set({ status: "aktif" }).where(eq(schema.tenants.id, "tnt_A01"));
    await toolDraftTagihan(db, PEMILIK, { periode: "2026-11", hariIni: HARI_INI });
    assert.deepEqual(await toolKoreksiDraft(db, percakapan, { kecualikan: ["A01"] }), {
      teks: "Semua kamar dikecualikan, jadi draft tagihan dibatalkan. Tidak ada tagihan yang dibuat.",
    });
  });

  it("koreksi hanya untuk draft tagihan; batal menutup draft apa pun", async () => {
    await db.update(schema.tenants).set({ status: "aktif" }).where(eq(schema.tenants.organizationId, ORG));
    const reminder = await siapkanDraftReminder(db, PEMILIK);
    await assert.rejects(
      toolKoreksiDraft(db, percakapan, { kecualikan: ["A05"] }),
      (err) => err instanceof GalatAksi && err.status === 409,
    );
    assert.deepEqual(await toolBatalDraft(db, percakapan), { teks: "Oke, dibatalkan. Tidak ada yang dikirim atau diubah." });
    assert.equal((await draft(reminder!.draftId!)).status, "dibatalkan");
  });
});

describe("toolSiapkanReminder", () => {
  let db: Db;
  let tutup: () => Promise<void>;
  const SEKARANG = new Date("2026-09-24T09:00:00+07:00");

  before(async () => {
    ({ db, tutup } = await buatDbUji());
    await isiDataContoh(db);
  });
  after(() => tutup());

  const catatReminder = (kamar: string, jamLalu: number) =>
    db.insert(schema.reminders).values({
      organizationId: ORG,
      invoiceId: `inv_2026-09_${kamar}`,
      tenantId: `tnt_${kamar}`,
      jenis: "manual",
      status: "terkirim",
      terkirimPada: new Date(SEKARANG.getTime() - jamLalu * 3_600_000),
    });

  it("preview semua penunggak + contoh pesan yang akan dikirim", async () => {
    const hasil = await toolSiapkanReminder(db, PEMILIK, { sekarang: SEKARANG });
    assert.ok(hasil.lampiran?.jenis === "preview_aksi");
    assert.deepEqual(hasil.lampiran.penerima.map((p) => p.nomorKamar), ["A05", "B06", "C05"]);
    assert.equal(hasil.lampiran.status, "menunggu_konfirmasi");
    assert.match(hasil.teks, /^Ini preview pengingat untuk 3 penyewa yang menunggak, total Rp1\.950\.000\. Belum ada pesan yang dikirim/);
    assert.match(hasil.teks, /Contoh pesan ke Rizky Ramadhan \(A05\):\nHalo Rizky, ini pengingat dari Kos Melati\. [\s\S]*Rp500\.000[\s\S]*\n\[link invoice\]$/);
  });

  it("penyewa yang dihubungi dalam 24 jam terakhir dilewati; yang lebih lama tetap diingatkan", async () => {
    await catatReminder("A05", 3);
    await catatReminder("B06", 30);
    const hasil = await toolSiapkanReminder(db, PEMILIK, { sekarang: SEKARANG });
    assert.ok(hasil.lampiran?.jenis === "preview_aksi");
    assert.deepEqual(hasil.lampiran.penerima.map((p) => p.nomorKamar), ["B06", "C05"]);
    assert.match(hasil.teks, /1 tagihan dilewati karena penyewanya sudah dihubungi dalam 24 jam terakhir/);
  });

  it("semua sudah dihubungi → tidak ada draft; tanpa tunggakan → dijawab jujur", async () => {
    await catatReminder("B06", 1);
    await catatReminder("C05", 1);
    assert.deepEqual(await toolSiapkanReminder(db, PEMILIK, { sekarang: SEKARANG }), {
      teks: "Semua penyewa yang menunggak sudah dihubungi dalam 24 jam terakhir. Coba lagi besok supaya tidak terkesan spam.",
    });
    await db.update(schema.invoices).set({ status: "lunas" }).where(eq(schema.invoices.status, "jatuh_tempo"));
    assert.deepEqual(await toolSiapkanReminder(db, PEMILIK, { sekarang: SEKARANG }), {
      teks: "Tidak ada tagihan yang lewat jatuh tempo, jadi belum ada yang perlu diingatkan.",
    });
  });
});

