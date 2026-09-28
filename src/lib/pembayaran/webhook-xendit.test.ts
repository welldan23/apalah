import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { eq } from "drizzle-orm";

import type { Db } from "../../db/index.ts";
import * as schema from "../../db/schema.ts";
import { isiDataContoh } from "../../db/seed.ts";
import { buatDbUji } from "../../db/testing.ts";
import { tanganiWebhookXendit } from "./webhook-xendit.ts";

const AKUN = "5cafeb170a2b18519b1b8761";
const TOKEN = "token-webhook-uji";
const KUNCI = "xnd_development_uji";
const ORDER = "inv_2026-09_A03~1";
const PR = "pr-a03-1";

/** Pembayaran seperti yang dikembalikan GET /v3/payments/{id}. */
const pembayaranXendit = (extra: Record<string, unknown> = {}) => ({
  payment_id: "py-a03-1",
  payment_request_id: PR,
  reference_id: ORDER,
  status: "SUCCEEDED",
  request_amount: 500_000,
  channel_code: "BCA_VIRTUAL_ACCOUNT",
  captures: [{ capture_id: "cptr-1", capture_timestamp: "2026-09-25T03:05:00Z", capture_amount: 500_000 }],
  ...extra,
});

describe("webhook Xendit", () => {
  let db: Db;
  let tutup: () => Promise<void>;
  let panggilan: { url: string; header: Record<string, string> }[];
  /** Balasan API Xendit palsu per jalur; tanpa entri → 404. */
  let api: Record<string, { status: number; body: Record<string, unknown> }>;
  const fetchPalsu = (async (url: string, init: RequestInit) => {
    panggilan.push({ url, header: init.headers as Record<string, string> });
    const b = api[new URL(url).pathname];
    return Response.json(b?.body ?? { error_code: "DATA_NOT_FOUND" }, { status: b?.status ?? 404 });
  }) as unknown as typeof fetch;

  const kirim = (body: Record<string, unknown>, token: string | null = TOKEN, env = { secretKey: KUNCI, tokenWebhook: TOKEN }) =>
    tanganiWebhookXendit(db, { body, token }, { ...env, fetch: fetchPalsu });
  const webhook = (event = "payment.capture", data: Record<string, unknown> = { payment_id: "py-a03-1", payment_request_id: PR }) => ({
    event,
    business_id: AKUN,
    created: "2026-09-25T03:05:01Z",
    data: { status: "SUCCEEDED", request_amount: 500_000, ...data },
  });
  const statusInvoice = async () =>
    (await db.select({ s: schema.invoices.status }).from(schema.invoices).where(eq(schema.invoices.id, "inv_2026-09_A03")))[0].s;
  const jumlahBayar = async () => (await db.select().from(schema.payments).where(eq(schema.payments.invoiceId, "inv_2026-09_A03"))).length;

  beforeEach(async () => {
    ({ db, tutup } = await buatDbUji());
    await isiDataContoh(db);
    panggilan = [];
    api = { "/v3/payments/py-a03-1": { status: 200, body: pembayaranXendit() } };
    // Transaksi VA yang dibuat Kostera dari halaman bayar, atas nama sub-akun kos.
    await db.insert(schema.paymentAttempts).values({
      organizationId: "org_kos_melati",
      invoiceId: "inv_2026-09_A03",
      percobaan: 1,
      orderId: ORDER,
      metode: "va_bca",
      nominal: 500_000,
      nomorVa: "381659999912345",
      referensiProvider: PR,
      akunGateway: AKUN,
      kedaluwarsaPada: new Date("2026-09-26T03:00:00Z"),
    });
  });
  afterEach(() => tutup());

  it("token salah / tanpa token / server tanpa token → 401, tidak ada yang diproses maupun ditanyakan ke Xendit", async () => {
    for (const hasil of [
      await kirim(webhook(), "token-lain"),
      await kirim(webhook(), null),
      await kirim(webhook(), TOKEN, { secretKey: KUNCI, tokenWebhook: "" }),
    ]) {
      assert.equal(hasil.status, 401);
    }
    assert.deepEqual([panggilan.length, await statusInvoice(), await jumlahBayar()], [0, "menunggu", 0]);
  });

  it("pembayaran berhasil: status dibaca ulang dari API Xendit atas nama sub-akun kos → Lunas; kirim ulang = duplikat", async () => {
    const hasil = await kirim(webhook());
    assert.deepEqual(hasil, {
      status: 200,
      body: { duplikat: false, hasil: "lunas", invoiceId: "inv_2026-09_A03", statusInvoice: "lunas" },
      invoiceId: "inv_2026-09_A03",
      statusInvoice: "lunas",
    });
    const [p] = panggilan;
    assert.equal(p.url, "https://api.xendit.co/v3/payments/py-a03-1");
    assert.deepEqual([p.header["for-user-id"], p.header["api-version"]], [AKUN, "2024-11-11"]);
    assert.equal(p.header.Authorization, `Basic ${Buffer.from(`${KUNCI}:`).toString("base64")}`);
    const [bayar] = await db.select().from(schema.payments).where(eq(schema.payments.referensiProvider, PR));
    assert.deepEqual([bayar.provider, bayar.status, bayar.nominalDibayar, bayar.metode], ["xendit", "valid", 500_000, "VA BCA"]);
    const [transaksi] = await db.select().from(schema.paymentAttempts).where(eq(schema.paymentAttempts.orderId, ORDER));
    assert.equal(transaksi.status, "berhasil");

    const ulang = await kirim(webhook());
    assert.deepEqual([ulang.status, ulang.body, ulang.invoiceId], [200, { duplikat: true }, undefined]);
    assert.equal(await jumlahBayar(), 1);
  });

  it("isi webhook dipalsukan (status/nominal) tidak dipercaya: yang dipakai data dari API Xendit", async () => {
    // Webhook bilang SUCCEEDED Rp500.000, padahal di Xendit pembayarannya baru diotorisasi.
    api["/v3/payments/py-a03-1"] = { status: 200, body: pembayaranXendit({ status: "AUTHORIZED", captures: [] }) };
    const hasil = await kirim(webhook("payment.capture", { payment_id: "py-a03-1", payment_request_id: PR, status: "SUCCEEDED" }));
    assert.equal(hasil.body.hasil, "menunggu pembayaran");
    assert.equal(await statusInvoice(), "menunggu");

    // Di Xendit ternyata hanya masuk Rp450.000 → Perlu review, bukan Lunas.
    api["/v3/payments/py-a03-2"] = {
      status: 200,
      body: pembayaranXendit({
        payment_id: "py-a03-2",
        captures: [{ capture_id: "c2", capture_timestamp: "2026-09-25T03:06:00Z", capture_amount: 450_000 }],
      }),
    };
    const kurang = await kirim(webhook("payment.capture", { payment_id: "py-a03-2", payment_request_id: PR, request_amount: 500_000 }));
    assert.deepEqual([kurang.statusInvoice, await statusInvoice()], ["perlu_review", "perlu_review"]);
  });

  it("payment_id milik transaksi lain / tidak ada di sub-akun kos → diabaikan, tidak Lunas", async () => {
    api["/v3/payments/py-lain"] = { status: 200, body: pembayaranXendit({ payment_id: "py-lain", payment_request_id: "pr-lain", reference_id: "inv_x~1" }) };
    const warn = console.warn;
    console.warn = () => {};
    try {
      const lain = await kirim(webhook("payment.capture", { payment_id: "py-lain", payment_request_id: PR }));
      assert.deepEqual([lain.status, lain.body], [200, { diabaikan: "tidak terverifikasi di Xendit" }]);
      const tidakAda = await kirim(webhook("payment.capture", { payment_id: "py-tidak-ada", payment_request_id: PR }));
      assert.deepEqual([tidakAda.status, tidakAda.body], [200, { diabaikan: "tidak terverifikasi di Xendit" }]);
    } finally {
      console.warn = warn;
    }
    assert.deepEqual([await statusInvoice(), await jumlahBayar()], ["menunggu", 0]);
  });

  it("transaksi yang bukan dibuat Kostera & event lain diabaikan tanpa bertanya ke Xendit", async () => {
    const asing = await kirim(webhook("payment.capture", { payment_id: "py-x", payment_request_id: "pr-bukan-kostera" }));
    assert.deepEqual(asing.body, { diabaikan: "transaksi bukan buatan Kostera" });
    const refund = await kirim(webhook("refund.succeeded"));
    assert.deepEqual(refund.body, { diabaikan: "event tidak diproses" });
    assert.equal(panggilan.length, 0);
  });

  it("API Xendit galat → dilempar (route menjawab 500 supaya Xendit mengirim ulang); kunci API belum diatur → 503", async () => {
    api["/v3/payments/py-a03-1"] = { status: 503, body: { error_code: "SERVER_ERROR" } };
    await assert.rejects(kirim(webhook()), /Xendit 503: SERVER_ERROR/);
    assert.equal(await statusInvoice(), "menunggu");
    const tanpaKunci = await kirim(webhook(), TOKEN, { secretKey: "", tokenWebhook: TOKEN });
    assert.equal(tanpaKunci.status, 503);
  });

  it("payment request kedaluwarsa (dicek ulang ke Xendit) → transaksi kedaluwarsa, tagihan tetap bisa dibayar", async () => {
    api[`/v3/payment_requests/${PR}`] = { status: 200, body: { payment_request_id: PR, reference_id: ORDER, status: "EXPIRED", request_amount: 500_000 } };
    const hasil = await kirim(webhook("payment_request.expiry", { payment_request_id: PR, status: "EXPIRED" }));
    assert.equal(hasil.body.hasil, "gagal: EXPIRED");
    assert.equal(panggilan[0].url, `https://api.xendit.co/v3/payment_requests/${PR}`);
    const [transaksi] = await db.select().from(schema.paymentAttempts).where(eq(schema.paymentAttempts.orderId, ORDER));
    assert.deepEqual([transaksi.status, await statusInvoice()], ["kedaluwarsa", "menunggu"]);
  });
});
