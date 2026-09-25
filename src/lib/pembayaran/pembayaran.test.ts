import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { and, eq } from "drizzle-orm";

import type { Db } from "../../db/index.ts";
import * as schema from "../../db/schema.ts";
import { isiDataContoh } from "../../db/seed.ts";
import { buatDbUji } from "../../db/testing.ts";
import type { PesanWhatsApp } from "../whatsapp/index.ts";
import { bacaNotifikasiMidtrans, tandaTanganMidtransValid } from "./midtrans.ts";
import { kirimKonfirmasiLunas } from "./konfirmasi.ts";
import { kirimNotifikasiPerluReview } from "./notifikasi-review.ts";
import { prosesNotifikasiPembayaran } from "./proses-notifikasi.ts";

const KUNCI = "SB-Mid-server-uji";

/** Notifikasi Midtrans bertanda tangan. */
function notif(orderId: string, trx: string, status: string, nominal: number, extra: Record<string, unknown> = {}) {
  const body: Record<string, unknown> = {
    order_id: orderId,
    transaction_id: trx,
    transaction_status: status,
    status_code: status === "settlement" ? "200" : "201",
    gross_amount: `${nominal}.00`,
    payment_type: "qris",
    transaction_time: "2026-09-24 10:00:00",
    settlement_time: status === "settlement" ? "2026-09-24 10:05:00" : undefined,
    ...extra,
  };
  body.signature_key = createHash("sha512").update(`${orderId}${body.status_code}${body.gross_amount}${KUNCI}`).digest("hex");
  return body;
}

describe("notifikasi Midtrans", () => {
  it("tanda tangan valid hanya dengan server key yang benar", () => {
    const body = notif("inv_1", "trx-1", "settlement", 500_000);
    assert.equal(tandaTanganMidtransValid(body, KUNCI), true);
    assert.equal(tandaTanganMidtransValid(body, "kunci-lain"), false);
    assert.equal(tandaTanganMidtransValid({ ...body, gross_amount: "1.00" }, KUNCI), false);
    assert.equal(tandaTanganMidtransValid(body, undefined), false);
    assert.equal(tandaTanganMidtransValid({ ...body, signature_key: "zz" }, KUNCI), false);
  });

  it("normalisasi: status, nominal, metode, waktu WIB, invoice dari order_id", () => {
    const n = bacaNotifikasiMidtrans(notif("inv_2026-09_A03~2", "trx-2", "settlement", 500_000, {
      payment_type: "bank_transfer",
      va_numbers: [{ bank: "bca", va_number: "123" }],
    }));
    assert.deepEqual(
      { ...n, payload: undefined },
      {
        provider: "midtrans",
        eventId: "trx-2:settlement",
        referensi: "trx-2",
        orderId: "inv_2026-09_A03~2",
        invoiceId: "inv_2026-09_A03",
        status: "berhasil",
        statusGateway: "settlement",
        nominal: 500_000,
        metode: "VA BCA",
        waktu: new Date("2026-09-24T03:05:00Z"),
        payload: undefined,
      },
    );
    assert.equal(bacaNotifikasiMidtrans(notif("x", "t", "capture", 1, { fraud_status: "challenge" }))?.status, "pending");
    assert.equal(bacaNotifikasiMidtrans(notif("x", "t", "expire", 1))?.status, "gagal");
    assert.equal(bacaNotifikasiMidtrans(notif("x", "t", "refund", 1))?.status, "abaikan");
    assert.equal(bacaNotifikasiMidtrans({ order_id: "x" }), null);
  });

  it("transaction_status tidak ikut ditandatangani: uang masuk hanya bila status_code 200", () => {
    // Notifikasi pending (201) yang sah, lalu transaction_status-nya diganti — tanda tangan tetap valid.
    const palsu = { ...notif("inv_1", "trx-p", "pending", 500_000), transaction_status: "settlement" };
    assert.equal(tandaTanganMidtransValid(palsu, KUNCI), true);
    assert.equal(bacaNotifikasiMidtrans(palsu)?.status, "abaikan");
    const captureTanpa200 = notif("inv_1", "trx-c", "capture", 500_000, { fraud_status: "accept" });
    assert.equal(captureTanpa200.status_code, "201");
    assert.equal(bacaNotifikasiMidtrans(captureTanpa200)?.status, "abaikan");
    const capture = notif("inv_1", "trx-c", "capture", 500_000, { fraud_status: "accept", status_code: "200" });
    assert.equal(bacaNotifikasiMidtrans(capture)?.status, "berhasil");
  });
});

describe("prosesNotifikasiPembayaran", () => {
  let db: Db;
  let tutup: () => Promise<void>;
  const proses = (body: Record<string, unknown>) => prosesNotifikasiPembayaran(db, bacaNotifikasiMidtrans(body)!);
  const invoice = async (id: string) => (await db.select().from(schema.invoices).where(eq(schema.invoices.id, id)))[0];
  const bayar = async (ref: string) =>
    db.select().from(schema.payments).where(eq(schema.payments.referensiProvider, ref));

  before(async () => {
    ({ db, tutup } = await buatDbUji());
    await isiDataContoh(db);
  });
  after(() => tutup());

  it("nominal cocok → pembayaran valid, invoice Lunas dengan waktu bayar", async () => {
    const hasil = await proses(notif("inv_2026-09_A03", "trx-A03", "settlement", 500_000));
    assert.deepEqual(hasil, { duplikat: false, hasil: "lunas", invoiceId: "inv_2026-09_A03", statusInvoice: "lunas" });
    const inv = await invoice("inv_2026-09_A03");
    assert.equal(inv.status, "lunas");
    assert.equal(inv.dibayarPada?.toISOString(), "2026-09-24T03:05:00.000Z");
    const [p] = await bayar("trx-A03");
    assert.deepEqual([p.status, p.nominalDibayar, p.metode], ["valid", 500_000, "QRIS"]);
  });

  it("notifikasi yang sama dikirim ulang → duplikat, tidak ada perubahan", async () => {
    assert.deepEqual(await proses(notif("inv_2026-09_A03", "trx-A03", "settlement", 500_000)), { duplikat: true });
    assert.equal((await bayar("trx-A03")).length, 1);
    const [ev] = await db.select().from(schema.webhookEvents).where(eq(schema.webhookEvents.eventId, "trx-A03:settlement"));
    assert.equal(ev.hasil, "lunas");
    assert.ok(ev.diprosesPada);
  });

  it("pending lalu settlement untuk transaksi yang sama → satu pembayaran, dari pending jadi valid", async () => {
    assert.equal((await proses(notif("inv_2026-09_A06~1", "trx-A06", "pending", 500_000))).duplikat, false);
    assert.equal((await bayar("trx-A06"))[0].status, "pending");
    assert.equal((await invoice("inv_2026-09_A06")).status, "menunggu");
    await proses(notif("inv_2026-09_A06~1", "trx-A06", "settlement", 500_000));
    const semua = await bayar("trx-A06");
    assert.equal(semua.length, 1);
    assert.equal(semua[0].status, "valid");
    assert.equal((await invoice("inv_2026-09_A06")).status, "lunas");
  });

  it("kurang bayar → Perlu review, bukan Lunas", async () => {
    const hasil = await proses(notif("inv_2026-09_A08", "trx-A08", "settlement", 450_000));
    assert.deepEqual(hasil, { duplikat: false, hasil: "perlu_review: kurang Rp50.000", invoiceId: "inv_2026-09_A08", statusInvoice: "perlu_review" });
    assert.equal((await bayar("trx-A08"))[0].status, "tidak_cocok");
  });

  it("pelunasan kekurangan → total pas, Lunas, pembayaran sebelumnya ikut sah", async () => {
    // C09: sudah masuk Rp750.000 (tidak cocok) dari tagihan Rp800.000.
    const hasil = await proses(notif("inv_2026-09_C09~2", "trx-C09-sisa", "settlement", 50_000));
    assert.equal(hasil.duplikat === false && hasil.hasil, "lunas");
    assert.equal((await invoice("inv_2026-09_C09")).status, "lunas");
    const semua = await db.select().from(schema.payments).where(eq(schema.payments.invoiceId, "inv_2026-09_C09"));
    assert.deepEqual(semua.map((p) => p.status).sort(), ["valid", "valid"]);
  });

  it("bayar ganda untuk invoice yang sudah lunas → Perlu review (lebih bayar)", async () => {
    const hasil = await proses(notif("inv_2026-09_A03~2", "trx-A03-lagi", "settlement", 500_000));
    assert.equal(hasil.duplikat === false && hasil.hasil, "perlu_review: lebih Rp500.000");
    assert.equal((await invoice("inv_2026-09_A03")).status, "perlu_review");
  });

  it("transaksi kedaluwarsa menghapus catatan pending; invoice tidak berubah", async () => {
    await proses(notif("inv_2026-09_A10", "trx-A10", "pending", 500_000));
    await proses(notif("inv_2026-09_A10", "trx-A10", "expire", 500_000));
    assert.equal((await bayar("trx-A10")).length, 0);
    assert.equal((await invoice("inv_2026-09_A10")).status, "menunggu");
  });

  it("invoice tidak dikenal & status refund dicatat sebagai diabaikan", async () => {
    assert.deepEqual(await proses(notif("inv_tidak_ada", "trx-x", "settlement", 1)), { duplikat: false, hasil: "diabaikan: invoice tidak ditemukan" });
    assert.deepEqual(await proses(notif("inv_2026-09_A01", "trx-y", "refund", 500_000)), { duplikat: false, hasil: "diabaikan: status refund" });
    assert.equal((await invoice("inv_2026-09_A01")).status, "lunas");
  });

  it("pending bertanda tangan sah yang transaction_status-nya diganti 'settlement' → tidak Lunas, tanpa pembayaran", async () => {
    const palsu = { ...notif("inv_2026-09_B14", "trx-B14", "pending", 650_000), transaction_status: "settlement" };
    assert.deepEqual(await proses(palsu), { duplikat: false, hasil: "diabaikan: status settlement" });
    assert.equal((await invoice("inv_2026-09_B14")).status, "menunggu");
    assert.equal((await bayar("trx-B14")).length, 0);
  });

  it("transaction_id berbeda dari transaksi yang dibuat untuk order itu → diabaikan; yang asli tetap diproses", async () => {
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
    // Notifikasi sah yang transaction_id-nya (tidak ditandatangani) diganti → event baru, tapi bukan transaksi order ini.
    const tiruan = notif("inv_2026-09_B16~1", "trx-B16-tiruan", "settlement", 650_000);
    assert.deepEqual(await proses(tiruan), {
      duplikat: false,
      hasil: "diabaikan: transaction_id bukan milik order ini",
      invoiceId: "inv_2026-09_B16",
    });
    assert.equal((await invoice("inv_2026-09_B16")).status, "menunggu");
    assert.equal((await bayar("trx-B16-tiruan")).length, 0);

    assert.equal((await proses(notif("inv_2026-09_B16~1", "trx-B16-asli", "settlement", 650_000))).duplikat, false);
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
    await prosesNotifikasiPembayaran(db, bacaNotifikasiMidtrans(notif("inv_2026-09_A03", "trx-k1", "settlement", 500_000))!);
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
    await prosesNotifikasiPembayaran(db, bacaNotifikasiMidtrans(notif("inv_2026-09_A08", "trx-r1", "settlement", 450_000))!);
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
