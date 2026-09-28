import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";

import { bacaPesanMasuk, tandaTanganValid, tantanganMeta } from "./webhook.ts";

const meta = (messages: unknown[], statuses: unknown[] = []) => ({
  object: "whatsapp_business_account",
  entry: [{ id: "1", changes: [{ field: "messages", value: { messaging_product: "whatsapp", messages, statuses } }] }],
});
const teksMeta = (id: string, from: string, body: string) => ({
  id,
  from,
  timestamp: "1790211600", // 2026-09-24 01:00 UTC
  type: "text",
  text: { body },
});
const waha = (payload: Record<string, unknown>, event = "message") => ({
  event,
  session: "default",
  payload: { id: "false_6281234567890@c.us_ABC", from: "6281234567890@c.us", fromMe: false, body: "halo", timestamp: 1790211600, ...payload },
});

describe("bacaPesanMasuk", () => {
  it("Meta: pesan teks → nomor ternormalisasi, id, waktu", () => {
    assert.deepEqual(bacaPesanMasuk(meta([teksMeta("wamid.1", "6281234567890", "  Berapa tunggakan?  ")])), [
      { idProvider: "wamid.1", dari: "6281234567890", teks: "Berapa tunggakan?", waktu: new Date("2026-09-24T01:00:00Z") },
    ]);
  });

  it("Meta: status pengiriman, media, dan nomor tidak valid diabaikan", () => {
    assert.deepEqual(bacaPesanMasuk(meta([], [{ id: "wamid.x", status: "delivered" }])), []);
    assert.deepEqual(bacaPesanMasuk(meta([{ ...teksMeta("wamid.2", "6281234567890", ""), type: "image" }])), []);
    assert.deepEqual(bacaPesanMasuk(meta([teksMeta("wamid.3", "12345", "halo")])), []);
  });

  it("WAHA: pesan pribadi dibaca; pesan sendiri, grup, @lid, dan event lain diabaikan", () => {
    assert.deepEqual(bacaPesanMasuk(waha({})), [
      { idProvider: "false_6281234567890@c.us_ABC", dari: "6281234567890", teks: "halo", waktu: new Date("2026-09-24T01:00:00Z") },
    ]);
    assert.deepEqual(bacaPesanMasuk(waha({ fromMe: true })), []);
    assert.deepEqual(bacaPesanMasuk(waha({ from: "120363000000@g.us" })), []);
    assert.deepEqual(bacaPesanMasuk(waha({ from: "1234567890@lid" })), []);
    assert.deepEqual(bacaPesanMasuk(waha({ body: "   " })), []);
    assert.deepEqual(bacaPesanMasuk(waha({}, "message.ack")), []);
  });

  it("bentuk lain → kosong", () => {
    for (const body of [null, "teks", [], { halo: 1 }]) assert.deepEqual(bacaPesanMasuk(body), []);
  });
});

describe("tandaTanganValid", () => {
  const isi = Buffer.from(JSON.stringify(waha({})));
  const rahasia = "rahasia-uji";
  const h = (headers: Record<string, string>) => new Headers(headers);

  it("Meta: X-Hub-Signature-256", () => {
    const tt = `sha256=${createHmac("sha256", rahasia).update(isi).digest("hex")}`;
    assert.equal(tandaTanganValid(isi, h({ "x-hub-signature-256": tt }), rahasia), true);
    assert.equal(tandaTanganValid(Buffer.from("ubah"), h({ "x-hub-signature-256": tt }), rahasia), false);
  });

  it("WAHA: X-Webhook-Hmac SHA-512", () => {
    const tt = createHmac("sha512", rahasia).update(isi).digest("hex");
    assert.equal(tandaTanganValid(isi, h({ "x-webhook-hmac": tt, "x-webhook-hmac-algorithm": "sha512" }), rahasia), true);
    assert.equal(tandaTanganValid(isi, h({ "x-webhook-hmac": tt }), "kunci-lain"), false);
    assert.equal(tandaTanganValid(isi, h({ "x-webhook-hmac": tt, "x-webhook-hmac-algorithm": "md5" }), rahasia), false);
  });

  it("tanpa header atau tanpa rahasia → ditolak", () => {
    const tt = createHmac("sha512", "").update(isi).digest("hex");
    assert.equal(tandaTanganValid(isi, h({}), rahasia), false);
    assert.equal(tandaTanganValid(isi, h({ "x-webhook-hmac": tt }), undefined), false);
    assert.equal(tandaTanganValid(isi, h({ "x-webhook-hmac": tt }), ""), false);
  });
});

describe("tantanganMeta", () => {
  const p = (q: string) => new URLSearchParams(q);
  it("mengembalikan challenge hanya bila token cocok", () => {
    assert.equal(tantanganMeta(p("hub.mode=subscribe&hub.verify_token=abc&hub.challenge=42"), "abc"), "42");
    assert.equal(tantanganMeta(p("hub.mode=subscribe&hub.verify_token=salah&hub.challenge=42"), "abc"), null);
    assert.equal(tantanganMeta(p("hub.mode=subscribe&hub.verify_token=&hub.challenge=42"), undefined), null);
  });
});
