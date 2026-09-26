import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, it } from "node:test";

import { eq } from "drizzle-orm";

import type { Db } from "../../db/index.ts";
import { kelolaPlatformAdmin } from "../../db/platform-admin.ts";
import * as schema from "../../db/schema.ts";
import { isiDataContoh } from "../../db/seed.ts";
import { buatDbUji } from "../../db/testing.ts";
import { GalatAksi } from "../aksi/galat.ts";
import { PILOT_DISUSPEND } from "../kosta/pilot.ts";
import { prosesPesanKosta } from "../kosta/proses-pesan.ts";
import { terimaWebhookWhatsApp } from "../kosta/webhook-masuk.ts";
import type { PengirimWhatsApp } from "../whatsapp/index.ts";
import { periksaAksesPlatform } from "./akses.ts";
import {
  aturAkunXendit,
  aturPilotKosta,
  bacaInputPilot,
  bacaInputXendit,
  cariWorkspace,
  getDetailWorkspace,
  getLogPlatform,
  getMetrikPlatform,
} from "./konsol.ts";

const ORG = "org_kos_melati";
const OWNER = "6281234567890"; // Ratna (usr_ratna)
const OWNER_GRIYA = "6281377009900"; // Hendra (usr_pemilik_griya)
const SEKARANG = new Date("2026-09-24T09:00:00+07:00");
// Nilai uji saja — bukan rahasia sungguhan.
const RAHASIA = "rahasia-webhook-uji-yang-panjang";

describe("konsol platform (platform_admin)", () => {
  let db: Db;
  let tutup: () => Promise<void>;
  const wa: PengirimWhatsApp = { provider: "uji", simulasi: true, kirim: async () => ({ ok: true }) };
  let urutan = 0;

  async function chatWa(teks: string, dari = OWNER) {
    const isi = Buffer.from(JSON.stringify({ event: "message", payload: { id: `wamid.pl.${++urutan}`, from: `${dari}@c.us`, body: teks, fromMe: false } }));
    const headers = new Headers({ "x-webhook-hmac": createHmac("sha512", RAHASIA).update(isi).digest("hex") });
    const { baru } = await terimaWebhookWhatsApp(db, { isi, headers, rahasia: RAHASIA });
    const balasan = await prosesPesanKosta(
      db,
      { conversationId: baru[0].conversationId, messageId: baru[0].messageId, teks, saluran: "whatsapp" },
      { wa, llm: null, baseUrl: "https://kostera.id", hariIni: "2026-09-24", sekarang: SEKARANG },
    );
    const [audit] = await db.select().from(schema.kostaAuditLogs).where(eq(schema.kostaAuditLogs.idPesanMasuk, baru[0].messageId));
    return { balasan, audit };
  }

  beforeEach(async () => {
    ({ db, tutup } = await buatDbUji());
    await isiDataContoh(db);
  });
  afterEach(() => tutup());

  it("akses: hanya platform_admin dengan sesi ≤ 12 jam; owner kos biasa bukan admin; diatur lewat skrip & tercatat", async () => {
    assert.deepEqual(await periksaAksesPlatform(db, { userId: "usr_ratna", sesiDibuatPada: SEKARANG, sekarang: SEKARANG }), { status: "bukan_admin" });

    assert.match(await kelolaPlatformAdmin(db, "tambah", "0812-3456-7890"), /sekarang platform admin/);
    assert.deepEqual(await periksaAksesPlatform(db, { userId: "usr_ratna", sesiDibuatPada: SEKARANG, sekarang: SEKARANG }), { status: "admin", userId: "usr_ratna" });
    const lama = new Date(SEKARANG.getTime() - 13 * 3_600_000);
    assert.deepEqual(await periksaAksesPlatform(db, { userId: "usr_ratna", sesiDibuatPada: lama, sekarang: SEKARANG }), { status: "sesi_lama" });
    // Owner kos lain tetap bukan admin.
    assert.equal((await periksaAksesPlatform(db, { userId: "usr_pemilik_griya", sesiDibuatPada: SEKARANG, sekarang: SEKARANG })).status, "bukan_admin");

    await assert.rejects(kelolaPlatformAdmin(db, "tambah", "0899 0000 0000"), /belum terdaftar/);
    await kelolaPlatformAdmin(db, "hapus", OWNER);
    assert.equal((await periksaAksesPlatform(db, { userId: "usr_ratna", sesiDibuatPada: SEKARANG, sekarang: SEKARANG })).status, "bukan_admin");
    assert.deepEqual((await getLogPlatform(db)).map((l) => [l.aksi, l.admin]), [["hapus_admin", null], ["tambah_admin", null]]);
  });

  it("metrik lintas workspace: angka agregat benar, tanpa data penyewa maupun nilai rahasia", async () => {
    await chatWa("siapa yang belum bayar?"); // 1 webhook diterima + balasan
    const ulang = Buffer.from(JSON.stringify({ event: "message", payload: { id: "wamid.pl.1", from: `${OWNER}@c.us`, body: "x", fromMe: false } }));
    await terimaWebhookWhatsApp(db, { isi: ulang, headers: new Headers({ "x-webhook-hmac": createHmac("sha512", RAHASIA).update(ulang).digest("hex") }), rahasia: RAHASIA });
    await terimaWebhookWhatsApp(db, { isi: ulang, headers: new Headers({ "x-webhook-hmac": "salah" }), rahasia: RAHASIA });
    await db.insert(schema.whatsappLogs).values([
      { organizationId: ORG, tujuan: "6281320465838", jenis: "pengingat", provider: "waha", status: "terkirim" },
      { organizationId: ORG, tujuan: "6281320465839", jenis: "pengingat", provider: "waha", status: "gagal", galat: "nomor tidak aktif" },
    ]);

    const env = { WHATSAPP_PROVIDER: "waha", WHATSAPP_NOMOR_UJI: "6281234567890,6281377009900", WHATSAPP_WEBHOOK_SECRET: RAHASIA, LLM_API_KEY: "kunci-llm-uji-panjang" };
    const m = await getMetrikPlatform(db, { sekarang: new Date(), env });
    assert.deepEqual(m.workspace, { total: 3, pemilikAktif: 2, pakaiKosta30Hari: 1, pilotDisuspend: 0 });
    assert.deepEqual(
      [m.provider.mode, m.provider.nomorUji, m.provider.rahasiaWebhook, m.provider.llmAktif],
      ["pilot/sandbox (WAHA)", 2, true, true],
    );
    assert.deepEqual([m.webhook24Jam.diterima, m.webhook24Jam.galat, m.webhook24Jam.duplikat], [2, 1, 1]);
    assert.equal(m.kirim24Jam.gagal, 1);
    assert.ok(m.kirim24Jam.terkirim >= 1);
    assert.equal(m.aksi.menungguKonfirmasi + m.aksi.kedaluwarsaBelumDibersihkan, 1); // draft contoh
    const json = JSON.stringify(m);
    for (const bocor of [RAHASIA, "kunci-llm-uji-panjang", "Rizky", "6281320465838", OWNER]) assert.ok(!json.includes(bocor), bocor);
  });

  it("cari workspace: potongan nama atau ID persis; wildcard dianggap huruf biasa", async () => {
    assert.deepEqual((await cariWorkspace(db, "melati")).map((w) => w.id), [ORG]);
    assert.deepEqual((await cariWorkspace(db, "org_griya_asri")).map((w) => w.namaKos), ["Griya Asri"]);
    assert.deepEqual(await cariWorkspace(db, "%"), []);
    assert.equal((await cariWorkspace(db, "")).length, 3);
  });

  it("detail workspace: status integrasi tanpa data penyewa, nomor disamarkan, akses tercatat", async () => {
    await chatWa("siapa yang belum bayar?");
    await kelolaPlatformAdmin(db, "tambah", OWNER_GRIYA);
    const w = await getDetailWorkspace(db, { organizationId: ORG, adminUserId: "usr_pemilik_griya" });
    assert.ok(w);
    assert.equal(w.namaKos, "Kos Melati");
    assert.deepEqual(w.pengelola.map((p) => p.nomorWa), ["6281****7890"]);
    assert.equal(w.eventKosta[0].intent, "list_arrears");
    const json = JSON.stringify(w);
    for (const bocor of ["Rizky", "Reza", "6281320465838", "belum bayar", OWNER]) assert.ok(!json.includes(bocor), bocor);
    const [log] = await getLogPlatform(db, 1);
    assert.deepEqual([log.aksi, log.admin, log.namaKos], ["lihat_workspace", "Hendra Wijaya", "Kos Melati"]);
    assert.equal(await getDetailWorkspace(db, { organizationId: "org_tidak_ada", adminUserId: "usr_pemilik_griya" }), null);
  });

  it("suspend pilot: Kosta berhenti untuk kos itu saja, data kos tidak berubah, tercatat; resume mengaktifkan lagi", async () => {
    const potret = async () =>
      JSON.stringify([
        await db.select().from(schema.invoices).orderBy(schema.invoices.id),
        await db.select().from(schema.payments).orderBy(schema.payments.id),
        await db.select().from(schema.tenants).orderBy(schema.tenants.id),
      ]);
    const sebelum = await potret();

    assert.throws(() => bacaInputPilot({ aktif: false, alasan: "x" }), GalatAksi);
    assert.throws(() => bacaInputPilot({ aktif: "tidak", alasan: "alasan panjang" }), GalatAksi);
    await assert.rejects(
      aturPilotKosta(db, { organizationId: "org_tidak_ada", aktif: false, alasan: "uji", adminUserId: "usr_ratna" }),
      (err) => err instanceof GalatAksi && err.status === 404,
    );

    await aturPilotKosta(db, { organizationId: ORG, aktif: false, alasan: "nomor WAHA diblokir", adminUserId: "usr_ratna" });
    const ditahan = await chatWa("siapa yang belum bayar?");
    assert.equal(ditahan.balasan.teks, PILOT_DISUSPEND);
    assert.deepEqual([ditahan.audit.intent, ditahan.audit.hasil, ditahan.audit.organizationId], ["pilot_suspended", "ditolak", ORG]);
    // Kos lain tetap dilayani.
    assert.notEqual((await chatWa("siapa yang belum bayar?", OWNER_GRIYA)).balasan.teks, PILOT_DISUSPEND);

    await aturPilotKosta(db, { organizationId: ORG, aktif: true, alasan: "sudah pulih", adminUserId: "usr_ratna" });
    assert.notEqual((await chatWa("siapa yang belum bayar?")).balasan.teks, PILOT_DISUSPEND);

    assert.equal(await potret(), sebelum);
    assert.deepEqual(
      (await getLogPlatform(db)).map((l) => [l.aksi, l.detail.alasan]),
      [["resume_pilot", "sudah pulih"], ["suspend_pilot", "nomor WAHA diblokir"]],
    );
    assert.equal((await getMetrikPlatform(db)).workspace.pilotDisuspend, 0);
  });

  it("sub-akun Xendit: format & alasan wajib, satu sub-akun untuk satu kos, perubahan akun lama → baru tercatat", async () => {
    const AKUN = "5cafeb170a2b18519b1b8761";
    assert.deepEqual(bacaInputXendit({ akunId: ` ${AKUN.toUpperCase()} `, alasan: "KYC owner disetujui" }), { akunId: AKUN, alasan: "KYC owner disetujui" });
    assert.deepEqual(bacaInputXendit({ akunId: null, alasan: "owner berhenti" }), { akunId: null, alasan: "owner berhenti" });
    for (const body of [{ akunId: "xnd_development_rahasia", alasan: "salah tempel" }, { akunId: "123", alasan: "terlalu pendek" }, { alasan: "tanpa akun" }, { akunId: AKUN }]) {
      assert.throws(() => bacaInputXendit(body), (err) => err instanceof GalatAksi && err.status === 400);
    }

    await aturAkunXendit(db, { organizationId: ORG, akunId: AKUN, alasan: "KYC owner disetujui", adminUserId: "usr_ratna" });
    assert.equal((await getDetailWorkspace(db, { organizationId: ORG, adminUserId: "usr_ratna" }))?.xenditAkunId, AKUN);
    await assert.rejects(
      aturAkunXendit(db, { organizationId: "org_griya_asri", akunId: AKUN, alasan: "salah kos", adminUserId: "usr_ratna" }),
      (err) => err instanceof GalatAksi && err.status === 409,
    );
    await assert.rejects(
      aturAkunXendit(db, { organizationId: "org_tidak_ada", akunId: null, alasan: "uji", adminUserId: "usr_ratna" }),
      (err) => err instanceof GalatAksi && err.status === 404,
    );
    await aturAkunXendit(db, { organizationId: ORG, akunId: null, alasan: "owner berhenti", adminUserId: "usr_ratna" });
    const [org] = await db.select({ akun: schema.organizations.xenditAkunId }).from(schema.organizations).where(eq(schema.organizations.id, ORG));
    assert.equal(org.akun, null);
    assert.deepEqual(
      (await getLogPlatform(db)).filter((l) => l.aksi === "atur_xendit").map((l) => l.detail),
      [
        { akunLama: AKUN, akunBaru: null, alasan: "owner berhenti" },
        { akunLama: null, akunBaru: AKUN, alasan: "KYC owner disetujui" },
      ],
    );
  });
});
