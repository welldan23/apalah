import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { and, eq } from "drizzle-orm";

import type { Db } from "../../db/index.ts";
import * as schema from "../../db/schema.ts";
import { isiDataContoh } from "../../db/seed.ts";
import { buatDbUji } from "../../db/testing.ts";
import type { PesanWhatsApp } from "../whatsapp/index.ts";
import { kirimKonfirmasiLunas } from "./konfirmasi.ts";
import { kirimNotifikasiPembayaranMasuk } from "./notifikasi-masuk.ts";
import { kirimNotifikasiPerluReview } from "./notifikasi-review.ts";
import { prosesNotifikasiPembayaran } from "./proses-notifikasi.ts";
import { bacaWebhookXendit, notifikasiXendit, tokenWebhookXenditValid, type EventXendit } from "./xendit.ts";

const EVENT: Record<string, EventXendit> = {
  SUCCEEDED: "payment.capture",
  AUTHORIZED: "payment.authorization",
  FAILED: "payment.failure",
  EXPIRED: "payment_request.expiry",
};

/** Objek pembayaran seperti hasil GET /v3/payments/{id} (sudah dibaca ulang dari API Xendit). */
function pembayaran(orderId: string, pr: string, status: string, nominal: number, extra: Record<string, unknown> = {}) {
  return {
    payment_id: `py-${pr}`,
    payment_request_id: pr,
    reference_id: orderId,
    type: "PAY",
    currency: "IDR",
    request_amount: nominal,
    channel_code: "QRIS",
    status,
    captures: status === "SUCCEEDED" ? [{ capture_id: `cptr-${pr}`, capture_timestamp: "2026-09-24T03:05:00Z", capture_amount: nominal }] : [],
    created: "2026-09-24T03:00:00Z",
    updated: "2026-09-24T03:05:00Z",
    ...extra,
  };
}

const notif = (orderId: string, pr: string, status: string, nominal: number, extra: Record<string, unknown> = {}) =>
  notifikasiXendit(EVENT[status] ?? "payment.capture", pembayaran(orderId, pr, status, nominal, extra))!;

describe("webhook & notifikasi Xendit", () => {
  it("token webhook dicocokkan persis; tanpa token di server, semua ditolak", () => {
    assert.equal(tokenWebhookXenditValid("token-rahasia", "token-rahasia"), true);
    assert.equal(tokenWebhookXenditValid("token-rahasiA", "token-rahasia"), false);
    assert.equal(tokenWebhookXenditValid("token", "token-rahasia"), false);
    assert.equal(tokenWebhookXenditValid(null, "token-rahasia"), false);
    assert.equal(tokenWebhookXenditValid("", undefined), false);
  });

  it("isi webhook hanya petunjuk ID; event lain (refund, token) tidak diproses", () => {
    const data = { payment_id: "py-1", payment_request_id: "pr-1", status: "SUCCEEDED" };
    assert.deepEqual(bacaWebhookXendit({ event: "payment.capture", data }), { event: "payment.capture", paymentRequestId: "pr-1", paymentId: "py-1" });
    assert.deepEqual(bacaWebhookXendit({ event: "payment_request.expiry", data: { payment_request_id: "pr-2" } }), {
      event: "payment_request.expiry",
      paymentRequestId: "pr-2",
      paymentId: undefined,
    });
    assert.equal(bacaWebhookXendit({ event: "refund.succeeded", data }), null);
    assert.equal(bacaWebhookXendit({ event: "payment.capture", data: { payment_request_id: "pr-1" } }), null);
    assert.equal(bacaWebhookXendit({ event: "payment.capture" }), null);
  });

  it("normalisasi: status, nominal dari capture, metode, waktu, invoice dari reference_id", () => {
    const n = notifikasiXendit(
      "payment.capture",
      pembayaran("inv_2026-09_A03~2", "pr-2", "SUCCEEDED", 500_000, {
        channel_code: "BCA_VIRTUAL_ACCOUNT",
        // Contoh resmi Xendit mengirim nominal sebagai teks.
        captures: [{ capture_id: "c", capture_timestamp: "2026-09-24T03:05:00Z", capture_amount: "500000" }],
      }),
    );
    assert.deepEqual(
      { ...n, payload: undefined },
      {
        provider: "xendit",
        eventId: "py-pr-2:SUCCEEDED",
        referensi: "pr-2",
        orderId: "inv_2026-09_A03~2",
        invoiceId: "inv_2026-09_A03",
        status: "berhasil",
        statusGateway: "SUCCEEDED",
        nominal: 500_000,
        metode: "VA BCA",
        waktu: new Date("2026-09-24T03:05:00Z"),
        payload: undefined,
      },
    );
    const status = (event: EventXendit, s: string) => notifikasiXendit(event, pembayaran("x", "pr", s, 1))?.status;
    assert.equal(status("payment.authorization", "AUTHORIZED"), "pending");
    assert.equal(status("payment.failure", "FAILED"), "gagal");
    assert.equal(status("payment.capture", "CANCELED"), "gagal");
    assert.equal(status("payment_request.expiry", "EXPIRED"), "kedaluwarsa");
    // Webhook kedaluwarsa tapi di Xendit ternyata sudah dibayar → bukan kedaluwarsa.
    assert.equal(status("payment_request.expiry", "SUCCEEDED"), "abaikan");
    assert.equal(status("payment.capture", "REFUNDED"), "abaikan");
    assert.equal(notifikasiXendit("payment.capture", { payment_request_id: "pr" }), null);
    assert.equal(notifikasiXendit("payment.capture", pembayaran("x", "pr", "SUCCEEDED", 0)), null);
  });
});

describe("prosesNotifikasiPembayaran", () => {
  let db: Db;
  let tutup: () => Promise<void>;
  const proses = (n: ReturnType<typeof notif>) => prosesNotifikasiPembayaran(db, n);
  const invoice = async (id: string) => (await db.select().from(schema.invoices).where(eq(schema.invoices.id, id)))[0];
  const bayar = async (ref: string) =>
    db.select().from(schema.payments).where(eq(schema.payments.referensiProvider, ref));

  before(async () => {
    ({ db, tutup } = await buatDbUji());
    await isiDataContoh(db);
  });
  after(() => tutup());

  it("nominal cocok → pembayaran valid, invoice Lunas dengan waktu bayar", async () => {
    const hasil = await proses(notif("inv_2026-09_A03", "trx-A03", "SUCCEEDED", 500_000));
    assert.deepEqual(hasil, { duplikat: false, hasil: "lunas", invoiceId: "inv_2026-09_A03", statusInvoice: "lunas" });
    const inv = await invoice("inv_2026-09_A03");
    assert.equal(inv.status, "lunas");
    assert.equal(inv.dibayarPada?.toISOString(), "2026-09-24T03:05:00.000Z");
    const [p] = await bayar("trx-A03");
    assert.deepEqual([p.status, p.nominalDibayar, p.metode], ["valid", 500_000, "QRIS"]);
  });

  it("notifikasi yang sama dikirim ulang → duplikat, tidak ada perubahan", async () => {
    assert.deepEqual(await proses(notif("inv_2026-09_A03", "trx-A03", "SUCCEEDED", 500_000)), { duplikat: true });
    assert.equal((await bayar("trx-A03")).length, 1);
    const [ev] = await db.select().from(schema.webhookEvents).where(eq(schema.webhookEvents.eventId, "py-trx-A03:SUCCEEDED"));
    assert.equal(ev.hasil, "lunas");
    assert.ok(ev.diprosesPada);
  });

  it("diotorisasi (pending) lalu berhasil untuk transaksi yang sama → satu pembayaran, dari pending jadi valid", async () => {
    assert.equal((await proses(notif("inv_2026-09_A06~1", "trx-A06", "AUTHORIZED", 500_000))).duplikat, false);
    assert.equal((await bayar("trx-A06"))[0].status, "pending");
    assert.equal((await invoice("inv_2026-09_A06")).status, "menunggu");
    await proses(notif("inv_2026-09_A06~1", "trx-A06", "SUCCEEDED", 500_000));
    const semua = await bayar("trx-A06");
    assert.equal(semua.length, 1);
    assert.equal(semua[0].status, "valid");
    assert.equal((await invoice("inv_2026-09_A06")).status, "lunas");
  });

  it("kurang bayar → Perlu review, bukan Lunas", async () => {
    const hasil = await proses(notif("inv_2026-09_A08", "trx-A08", "SUCCEEDED", 450_000));
    assert.deepEqual(hasil, { duplikat: false, hasil: "perlu_review: kurang Rp50.000", invoiceId: "inv_2026-09_A08", statusInvoice: "perlu_review" });
    assert.equal((await bayar("trx-A08"))[0].status, "tidak_cocok");
  });

  it("pelunasan kekurangan → total pas, Lunas, pembayaran sebelumnya ikut sah", async () => {
    // C09: sudah masuk Rp750.000 (tidak cocok) dari tagihan Rp800.000.
    const hasil = await proses(notif("inv_2026-09_C09~2", "trx-C09-sisa", "SUCCEEDED", 50_000));
    assert.equal(hasil.duplikat === false && hasil.hasil, "lunas");
    assert.equal((await invoice("inv_2026-09_C09")).status, "lunas");
    const semua = await db.select().from(schema.payments).where(eq(schema.payments.invoiceId, "inv_2026-09_C09"));
    assert.deepEqual(semua.map((p) => p.status).sort(), ["valid", "valid"]);
  });

  it("bayar ganda untuk invoice yang sudah lunas → Perlu review (lebih bayar)", async () => {
    const hasil = await proses(notif("inv_2026-09_A03~2", "trx-A03-lagi", "SUCCEEDED", 500_000));
    assert.equal(hasil.duplikat === false && hasil.hasil, "perlu_review: lebih Rp500.000");
    assert.equal((await invoice("inv_2026-09_A03")).status, "perlu_review");
  });

  it("transaksi kedaluwarsa menghapus catatan pending; invoice tidak berubah", async () => {
    await proses(notif("inv_2026-09_A10", "trx-A10", "AUTHORIZED", 500_000));
    await proses(notif("inv_2026-09_A10", "trx-A10", "EXPIRED", 500_000, { payment_id: undefined }));
    assert.equal((await bayar("trx-A10")).length, 0);
    assert.equal((await invoice("inv_2026-09_A10")).status, "menunggu");
  });

  it("invoice tidak dikenal & status yang tidak dikenal dicatat sebagai diabaikan", async () => {
    assert.deepEqual(await proses(notif("inv_tidak_ada", "trx-x", "SUCCEEDED", 1)), { duplikat: false, hasil: "diabaikan: invoice tidak ditemukan" });
    assert.deepEqual(await proses(notif("inv_2026-09_A01", "trx-y", "REFUNDED", 500_000)), { duplikat: false, hasil: "diabaikan: status REFUNDED" });
    assert.equal((await invoice("inv_2026-09_A01")).status, "lunas");
  });

  it("referensi berbeda dari transaksi yang dibuat untuk order itu → diabaikan; yang asli tetap diproses", async () => {
    const [inv] = await db.select().from(schema.invoices).where(eq(schema.invoices.id, "inv_2026-09_B16"));
    await db.insert(schema.paymentAttempts).values({
      organizationId: inv.organizationId,
      invoiceId: inv.id,
      percobaan: 1,
      orderId: "inv_2026-09_B16~1",
      metode: "qris",
      nominal: inv.nominal,
      qrString: "QR-UJI",
      referensiProvider: "trx-B16-asli",
      kedaluwarsaPada: new Date("2026-09-24T04:00:00Z"),
    });
    // Pembayaran sah milik payment request lain yang memakai reference_id order ini → bukan transaksi order ini.
    const tiruan = notif("inv_2026-09_B16~1", "trx-B16-tiruan", "SUCCEEDED", 650_000);
    assert.deepEqual(await proses(tiruan), {
      duplikat: false,
      hasil: "diabaikan: referensi transaksi bukan milik order ini",
      invoiceId: "inv_2026-09_B16",
    });
    assert.equal((await invoice("inv_2026-09_B16")).status, "menunggu");
    assert.equal((await bayar("trx-B16-tiruan")).length, 0);

    assert.equal((await proses(notif("inv_2026-09_B16~1", "trx-B16-asli", "SUCCEEDED", 650_000))).duplikat, false);
    assert.equal((await invoice("inv_2026-09_B16")).status, "lunas");
  });
});

describe("kirimKonfirmasiLunas", () => {
  let db: Db;
  let tutup: () => Promise<void>;
  const terkirim: PesanWhatsApp[] = [];
  const wa = {
    provider: "uji",
    simulasi: false,
    async kirim(p: PesanWhatsApp) {
      terkirim.push(p);
      return { ok: true as const };
    },
  };

  before(async () => {
    ({ db, tutup } = await buatDbUji());
    await isiDataContoh(db);
  });
  after(() => tutup());

  it("tagihan yang baru Lunas → pesan terima kasih + link bukti, tercatat di riwayat", async () => {
    await prosesNotifikasiPembayaran(db, notif("inv_2026-09_A03", "trx-k1", "SUCCEEDED", 500_000));
    assert.equal(await kirimKonfirmasiLunas(db, "inv_2026-09_A03", { wa, baseUrl: "https://kostera.id" }), true);
    assert.equal(terkirim[0].ke, "6281320465838");
    assert.match(terkirim[0].teks, /^Halo Yoga, pembayaran sewa kamar A03 di Kos Melati periode September 2026 sebesar Rp500\.000 sudah kami terima\./);
    assert.match(terkirim[0].teks, /https:\/\/kostera\.id\/invoice\/demo-a03-2026-09$/);
    assert.deepEqual([terkirim[0].template?.nama, terkirim[0].template?.tombolUrl], ["kostera_pembayaran_diterima", "demo-a03-2026-09"]);
    const [r] = await db
      .select()
      .from(schema.reminders)
      .where(and(eq(schema.reminders.invoiceId, "inv_2026-09_A03"), eq(schema.reminders.jenis, "konfirmasi_lunas")));
    assert.deepEqual([r.jenis, r.status], ["konfirmasi_lunas", "terkirim"]);
  });

  it("tagihan yang belum lunas tidak dikonfirmasi", async () => {
    assert.equal(await kirimKonfirmasiLunas(db, "inv_2026-09_A05", { wa, baseUrl: "https://kostera.id" }), false);
    assert.equal(terkirim.length, 1);
  });
});

describe("kirimNotifikasiPerluReview", () => {
  let db: Db;
  let tutup: () => Promise<void>;
  const terkirim: PesanWhatsApp[] = [];
  const wa = {
    provider: "uji",
    simulasi: false,
    async kirim(p: PesanWhatsApp) {
      terkirim.push(p);
      return { ok: true as const };
    },
  };

  before(async () => {
    ({ db, tutup } = await buatDbUji());
    await isiDataContoh(db);
  });
  after(() => tutup());

  it("owner dapat WhatsApp berisi selisih & link, tercatat di riwayat chat Kosta", async () => {
    await prosesNotifikasiPembayaran(db, notif("inv_2026-09_A08", "trx-r1", "SUCCEEDED", 450_000));
    assert.equal(await kirimNotifikasiPerluReview(db, "inv_2026-09_A08", { wa, baseUrl: "https://kostera.id" }), 1);
    assert.equal(terkirim[0].ke, "6281234567890");
    assert.equal(
      terkirim[0].teks,
      [
        "Perlu diperiksa — Kos Melati",
        "Pembayaran kamar A08 (Bagus Wicaksono) periode September 2026: diterima Rp450.000 dari tagihan Rp500.000 (kurang Rp50.000).",
        "Status tidak diubah jadi Lunas sampai kamu memeriksanya.",
        "Cek: https://kostera.id/pembayaran?status=perlu_review",
      ].join("\n"),
    );
    // Pesan dimulai bisnis → lewat Cloud API wajib template resmi (owner belum tentu chat dalam 24 jam).
    assert.deepEqual(terkirim[0].template, {
      nama: "kostera_pembayaran_perlu_dicek",
      bahasa: "id",
      variabel: ["Kos Melati", "A08", "Bagus Wicaksono", "September 2026", "Rp450.000", "Rp500.000", "kurang Rp50.000"],
    });
    const riwayat = await db.select().from(schema.waMessages).where(eq(schema.waMessages.conversationId, "wac_owner_kos_melati"));
    assert.ok(riwayat.some((m) => m.arah === "keluar" && m.isi.startsWith("Perlu diperiksa — Kos Melati")));
  });

  it("tagihan yang tidak Perlu review tidak memicu notifikasi", async () => {
    assert.equal(await kirimNotifikasiPerluReview(db, "inv_2026-09_A01", { wa, baseUrl: "https://kostera.id" }), 0);
    assert.equal(terkirim.length, 1);
  });
});

describe("kirimNotifikasiPembayaranMasuk", () => {
  let db: Db;
  let tutup: () => Promise<void>;
  const terkirim: PesanWhatsApp[] = [];
  const wa = {
    provider: "uji",
    simulasi: false,
    async kirim(p: PesanWhatsApp) {
      terkirim.push(p);
      return { ok: true as const };
    },
  };

  before(async () => {
    ({ db, tutup } = await buatDbUji());
    await isiDataContoh(db);
  });
  after(() => tutup());

  it("tagihan Lunas lewat gateway → owner dapat kabar uang masuk (template resmi), tercatat di log & riwayat chat", async () => {
    await prosesNotifikasiPembayaran(db, notif("inv_2026-09_A03", "trx-m1", "SUCCEEDED", 500_000, { channel_code: "BRI_VIRTUAL_ACCOUNT" }));
    assert.equal(await kirimNotifikasiPembayaranMasuk(db, "inv_2026-09_A03", { wa, baseUrl: "https://app.kostera.id" }), 1);
    assert.equal(terkirim[0].ke, "6281234567890");
    assert.equal(
      terkirim[0].teks,
      [
        "Pembayaran masuk — Kos Melati",
        "Kamar A03 (Yoga Saputra) membayar sewa periode September 2026 sebesar Rp500.000 lewat VA BRI. Tagihan otomatis Lunas dan bukti bayar dikirim ke penyewa.",
        "Uangnya masuk ke saldo Xendit kos kamu (dipotong biaya transaksi Xendit).",
        "Lihat: https://app.kostera.id/pembayaran",
      ].join("\n"),
    );
    assert.deepEqual(terkirim[0].template, {
      nama: "kostera_pembayaran_masuk",
      bahasa: "id",
      variabel: ["Kos Melati", "A03", "Yoga Saputra", "September 2026", "Rp500.000", "VA BRI"],
    });
    const [log] = await db.select().from(schema.whatsappLogs).where(eq(schema.whatsappLogs.jenis, "pembayaran_masuk"));
    assert.deepEqual([log.referensiId, log.template, log.status], ["inv_2026-09_A03", "kostera_pembayaran_masuk", "terkirim"]);
    const riwayat = await db.select().from(schema.waMessages).where(eq(schema.waMessages.conversationId, "wac_owner_kos_melati"));
    assert.ok(riwayat.some((m) => m.arah === "keluar" && m.isi.startsWith("Pembayaran masuk — Kos Melati")));
  });

  it("tagihan yang belum Lunas tidak memicu kabar uang masuk", async () => {
    assert.equal(await kirimNotifikasiPembayaranMasuk(db, "inv_2026-09_A05", { wa, baseUrl: "https://app.kostera.id" }), 0);
    assert.equal(terkirim.length, 1);
  });
});
