import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { eq } from "drizzle-orm";

import type { Db } from "../../db/index.ts";
import * as schema from "../../db/schema.ts";
import { isiDataContoh } from "../../db/seed.ts";
import { buatDbUji } from "../../db/testing.ts";
import { GalatAksi } from "../aksi/galat.ts";
import { getInvoicePublik } from "../data/invoice-publik.ts";
import type { GatewayPembayaran, PermintaanTransaksi } from "./gateway.ts";
import { bacaNotifikasiMidtrans } from "./midtrans.ts";
import { prosesNotifikasiPembayaran } from "./proses-notifikasi.ts";
import { bacaMetodeBayar, buatTransaksiBayar, GALAT_GATEWAY } from "./transaksi.ts";

// A03: Rp500.000, Menunggu. C09: Rp800.000, sudah masuk Rp750.000 (Perlu review). A01: Lunas.
const TOKEN_A03 = "demo-a03-2026-09";
const SEKARANG = new Date("2026-09-25T10:00:00+07:00");

function gatewayUji({ gagal = false, jeda = 0 } = {}) {
  const permintaan: PermintaanTransaksi[] = [];
  const gateway: GatewayPembayaran = {
    provider: "uji",
    simulasi: false,
    async buatTransaksi(p) {
      permintaan.push(p);
      if (jeda) await new Promise((r) => setTimeout(r, jeda));
      if (gagal) throw new Error("Midtrans 500: internal error");
      const kedaluwarsaPada = new Date(SEKARANG.getTime() + p.masaBerlakuMenit * 60_000);
      return p.metode === "qris"
        ? { referensi: `trx-${p.orderId}`, kedaluwarsaPada, qrString: `QR-${p.orderId}` }
        : { referensi: `trx-${p.orderId}`, kedaluwarsaPada, nomorVa: "8808000012345678" };
    },
  };
  return { gateway, permintaan };
}

/** Notifikasi Midtrans (tanda tangan sudah diverifikasi di route). */
const notif = (orderId: string, status: string, nominal: number) =>
  bacaNotifikasiMidtrans({
    order_id: orderId,
    transaction_id: `trx-${orderId}`,
    transaction_status: status,
    gross_amount: `${nominal}.00`,
    payment_type: "bank_transfer",
    va_numbers: [{ bank: "bca", va_number: "8808000012345678" }],
    settlement_time: status === "settlement" ? "2026-09-25 10:05:00" : undefined,
  })!;

describe("buat transaksi bayar dari link invoice", () => {
  let db: Db;
  let tutup: () => Promise<void>;
  const transaksiDari = (invoiceId: string) =>
    db.select().from(schema.paymentAttempts).where(eq(schema.paymentAttempts.invoiceId, invoiceId));
  const gagalDengan = (aksi: Promise<unknown>, status: number, pesan?: RegExp) =>
    assert.rejects(aksi, (err) => err instanceof GalatAksi && err.status === status && (!pesan || pesan.test(err.message)));

  beforeEach(async () => {
    ({ db, tutup } = await buatDbUji());
    await isiDataContoh(db);
  });
  afterEach(() => tutup());

  it("membuat transaksi untuk sisa tagihan dan menyimpan instruksinya", async () => {
    const { gateway, permintaan } = gatewayUji();
    const instruksi = await buatTransaksiBayar(db, TOKEN_A03, "va_bca", { gateway, sekarang: SEKARANG });
    assert.deepEqual(permintaan, [{ orderId: "inv_2026-09_A03~1", nominal: 500_000, metode: "va_bca", masaBerlakuMenit: 1440 }]);
    assert.deepEqual(instruksi, {
      metode: "va_bca",
      nominal: 500_000,
      kedaluwarsaPada: "2026-09-26T03:00:00.000Z",
      nomorVa: "8808000012345678",
    });
    const [t] = await transaksiDari("inv_2026-09_A03");
    assert.deepEqual(
      [t.organizationId, t.percobaan, t.orderId, t.status, t.referensiProvider],
      ["org_kos_melati", 1, "inv_2026-09_A03~1", "menunggu", "trx-inv_2026-09_A03~1"],
    );
  });

  it("idempoten: metode sama saat masih berlaku → instruksi yang sama, tanpa transaksi baru", async () => {
    const { gateway, permintaan } = gatewayUji();
    const pertama = await buatTransaksiBayar(db, TOKEN_A03, "qris", { gateway, sekarang: SEKARANG });
    const ulang = await buatTransaksiBayar(db, TOKEN_A03, "qris", { gateway, sekarang: new Date(SEKARANG.getTime() + 5 * 60_000) });
    assert.deepEqual(ulang, pertama);
    assert.equal(permintaan.length, 1);

    // Ganti metode → transaksi baru; QRIS yang hampir habis (sisa < 1 menit) tidak dipakai ulang.
    await buatTransaksiBayar(db, TOKEN_A03, "va_bni", { gateway, sekarang: SEKARANG });
    const hampirHabis = await buatTransaksiBayar(db, TOKEN_A03, "qris", { gateway, sekarang: new Date(SEKARANG.getTime() + 14.5 * 60_000) });
    assert.equal(hampirHabis.qrString, "QR-inv_2026-09_A03~3");
    assert.deepEqual(permintaan.map((p) => p.orderId), ["inv_2026-09_A03~1", "inv_2026-09_A03~2", "inv_2026-09_A03~3"]);
  });

  it("dua permintaan bersamaan → satu transaksi di gateway", async () => {
    const { gateway, permintaan } = gatewayUji({ jeda: 20 });
    const [a, b] = await Promise.all([
      buatTransaksiBayar(db, TOKEN_A03, "va_bri", { gateway, sekarang: SEKARANG }),
      buatTransaksiBayar(db, TOKEN_A03, "va_bri", { gateway, sekarang: SEKARANG }),
    ]);
    assert.deepEqual(a, b);
    assert.equal(permintaan.length, 1);
    assert.equal((await transaksiDari("inv_2026-09_A03")).length, 1);
  });

  it("kurang bayar yang diperiksa: nominal transaksi = sisa", async () => {
    const { gateway } = gatewayUji();
    const instruksi = await buatTransaksiBayar(db, "demo-c09-2026-09", "qris", { gateway, sekarang: SEKARANG });
    assert.equal(instruksi.nominal, 50_000);
  });

  it("menolak tagihan lunas, draf, token tak dikenal, dan metode yang tidak tersedia", async () => {
    const { gateway, permintaan } = gatewayUji();
    await gagalDengan(buatTransaksiBayar(db, "demo-a01-2026-09", "qris", { gateway }), 409, /sudah dibayar/);
    await db.update(schema.invoices).set({ status: "draft" }).where(eq(schema.invoices.tokenPublik, TOKEN_A03));
    await gagalDengan(buatTransaksiBayar(db, TOKEN_A03, "qris", { gateway }), 409, /masih draf/);
    await gagalDengan(buatTransaksiBayar(db, "demo-z99-2026-09", "qris", { gateway }), 404);
    await gagalDengan(buatTransaksiBayar(db, "' or 1=1 --", "qris", { gateway }), 404);
    assert.equal(permintaan.length, 0);
    assert.equal(bacaMetodeBayar({ metode: "va_mandiri" }), "va_mandiri");
    for (const body of [{}, { metode: "kartu_kredit" }, { metode: 1 }]) {
      assert.throws(() => bacaMetodeBayar(body), (err) => err instanceof GalatAksi && err.status === 400);
    }
  });

  it("gateway gagal → 502 dengan pesan jelas, tidak ada transaksi tersimpan", async () => {
    const { gateway } = gatewayUji({ gagal: true });
    const galat = console.error;
    console.error = () => {};
    try {
      await gagalDengan(buatTransaksiBayar(db, TOKEN_A03, "va_bca", { gateway, sekarang: SEKARANG }), 502);
    } finally {
      console.error = galat;
    }
    assert.equal(GALAT_GATEWAY.includes("Coba lagi"), true);
    assert.equal((await transaksiDari("inv_2026-09_A03")).length, 0);
  });

  describe("notifikasi gateway untuk transaksi dari halaman bayar", () => {
    it("pending = menunggu dibayar (bukan uang masuk); settlement → Lunas & transaksi berhasil; ulang = duplikat", async () => {
      const { gateway } = gatewayUji();
      await buatTransaksiBayar(db, TOKEN_A03, "va_bca", { gateway, sekarang: SEKARANG });
      const order = "inv_2026-09_A03~1";

      assert.deepEqual(await prosesNotifikasiPembayaran(db, notif(order, "pending", 500_000)), {
        duplikat: false,
        hasil: "menunggu pembayaran",
        invoiceId: "inv_2026-09_A03",
        statusInvoice: "menunggu",
      });
      const saatPending = await getInvoicePublik(db, TOKEN_A03);
      assert.deepEqual([saatPending?.pembayaran, saatPending?.bisaDibayar], [[], true]);

      const lunas = await prosesNotifikasiPembayaran(db, notif(order, "settlement", 500_000));
      assert.equal(!lunas.duplikat && lunas.statusInvoice, "lunas");
      assert.deepEqual(await prosesNotifikasiPembayaran(db, notif(order, "settlement", 500_000)), { duplikat: true });
      const [t] = await transaksiDari("inv_2026-09_A03");
      assert.equal(t.status, "berhasil");
      const inv = await getInvoicePublik(db, TOKEN_A03);
      assert.deepEqual([inv?.status, inv?.sisa, inv?.pembayaran.map((p) => [p.metode, p.status])], ["lunas", 0, [["VA BCA", "valid"]]]);

      // Notifikasi kedaluwarsa yang terlambat tidak menimpa transaksi yang sudah berhasil.
      await prosesNotifikasiPembayaran(db, notif(order, "expire", 500_000));
      assert.equal((await transaksiDari("inv_2026-09_A03"))[0].status, "berhasil");
    });

    it("expire → kedaluwarsa, deny/cancel → gagal; tagihan tetap bisa dibayar", async () => {
      const { gateway } = gatewayUji();
      await buatTransaksiBayar(db, TOKEN_A03, "qris", { gateway, sekarang: SEKARANG });
      await buatTransaksiBayar(db, TOKEN_A03, "va_bca", { gateway, sekarang: SEKARANG });
      await prosesNotifikasiPembayaran(db, notif("inv_2026-09_A03~1", "expire", 500_000));
      await prosesNotifikasiPembayaran(db, notif("inv_2026-09_A03~2", "cancel", 500_000));
      const status = (await transaksiDari("inv_2026-09_A03")).sort((a, b) => a.percobaan - b.percobaan).map((t) => t.status);
      assert.deepEqual(status, ["kedaluwarsa", "gagal"]);
      assert.equal((await getInvoicePublik(db, TOKEN_A03))?.bisaDibayar, true);
    });
  });
});
