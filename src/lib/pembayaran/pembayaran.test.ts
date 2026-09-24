import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { eq } from "drizzle-orm";

import type { Db } from "../../db/index.ts";
import * as schema from "../../db/schema.ts";
import { isiDataContoh } from "../../db/seed.ts";
import { buatDbUji } from "../../db/testing.ts";
import { bacaNotifikasiMidtrans, tandaTanganMidtransValid } from "./midtrans.ts";
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

  it("nominal tidak cocok → Perlu review, bukan Lunas", async () => {
    const hasil = await proses(notif("inv_2026-09_A08", "trx-A08", "settlement", 450_000));
    assert.deepEqual(hasil, { duplikat: false, hasil: "perlu_review: nominal tidak cocok", invoiceId: "inv_2026-09_A08", statusInvoice: "perlu_review" });
    assert.equal((await bayar("trx-A08"))[0].status, "tidak_cocok");
  });

  it("bayar ganda untuk invoice yang sudah lunas → Perlu review", async () => {
    const hasil = await proses(notif("inv_2026-09_A03~2", "trx-A03-lagi", "settlement", 500_000));
    assert.equal(hasil.duplikat === false && hasil.hasil, "perlu_review: pembayaran ganda");
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
});
