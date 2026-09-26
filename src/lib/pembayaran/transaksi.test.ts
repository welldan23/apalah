import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { eq } from "drizzle-orm";

import type { Db } from "../../db/index.ts";
import * as schema from "../../db/schema.ts";
import { isiDataContoh } from "../../db/seed.ts";
import { buatDbUji } from "../../db/testing.ts";
import { GalatAksi } from "../aksi/galat.ts";
import { getInvoicePublik } from "../data/invoice-publik.ts";
import { getGatewayPembayaran, type GatewayPembayaran, type PermintaanTransaksi } from "./gateway.ts";
import { prosesNotifikasiPembayaran } from "./proses-notifikasi.ts";
import { bacaMetodeBayar, buatTransaksiBayar, GALAT_BELUM_AKTIF, GALAT_GATEWAY } from "./transaksi.ts";
import { notifikasiXendit, type EventXendit } from "./xendit.ts";

// A03: Rp500.000, Menunggu. C09: Rp800.000, sudah masuk Rp750.000 (Perlu review). A01: Lunas.
const TOKEN_A03 = "demo-a03-2026-09";
const SEKARANG = new Date("2026-09-25T10:00:00+07:00");
/** Sub-akun xenPlatform Kos Melati di uji ini. */
const AKUN = "5cafeb170a2b18519b1b8761";

function gatewayUji({ gagal = false, jeda = 0 } = {}) {
  const permintaan: PermintaanTransaksi[] = [];
  const gateway: GatewayPembayaran = {
    provider: "uji",
    simulasi: false,
    async buatTransaksi(p) {
      permintaan.push(p);
      if (jeda) await new Promise((r) => setTimeout(r, jeda));
      if (gagal) throw new Error("Xendit 500: SERVER_ERROR");
      const kedaluwarsaPada = new Date(SEKARANG.getTime() + p.masaBerlakuMenit * 60_000);
      return p.metode === "qris"
        ? { referensi: `trx-${p.orderId}`, kedaluwarsaPada, qrString: `QR-${p.orderId}` }
        : { referensi: `trx-${p.orderId}`, kedaluwarsaPada, nomorVa: "8808000012345678" };
    },
  };
  return { gateway, permintaan };
}

const EVENT: Record<string, EventXendit> = {
  SUCCEEDED: "payment.capture",
  AUTHORIZED: "payment.authorization",
  FAILED: "payment.failure",
  EXPIRED: "payment_request.expiry",
};

/** Notifikasi dari data yang sudah dibaca ulang dari API Xendit (lihat webhook-xendit). */
const notif = (orderId: string, status: string, nominal: number) =>
  notifikasiXendit(EVENT[status], {
    payment_id: `py-${orderId}`,
    payment_request_id: `trx-${orderId}`,
    reference_id: orderId,
    status,
    request_amount: nominal,
    channel_code: "BCA_VIRTUAL_ACCOUNT",
    captures: status === "SUCCEEDED" ? [{ capture_amount: nominal, capture_timestamp: "2026-09-25T03:05:00Z" }] : [],
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
    await db.update(schema.organizations).set({ xenditAkunId: AKUN }).where(eq(schema.organizations.id, "org_kos_melati"));
  });
  afterEach(() => tutup());

  it("membuat transaksi untuk sisa tagihan dan menyimpan instruksinya", async () => {
    const { gateway, permintaan } = gatewayUji();
    const instruksi = await buatTransaksiBayar(db, TOKEN_A03, "va_bca", { gateway, sekarang: SEKARANG });
    assert.deepEqual(permintaan, [
      { orderId: "inv_2026-09_A03~1", nominal: 500_000, metode: "va_bca", masaBerlakuMenit: 1440, akunId: AKUN, namaPenerima: "Kos Melati" },
    ]);
    assert.deepEqual(instruksi, {
      metode: "va_bca",
      nominal: 500_000,
      kedaluwarsaPada: "2026-09-26T03:00:00.000Z",
      nomorVa: "8808000012345678",
    });
    const [t] = await transaksiDari("inv_2026-09_A03");
    assert.deepEqual(
      [t.organizationId, t.percobaan, t.orderId, t.status, t.referensiProvider, t.akunGateway],
      ["org_kos_melati", 1, "inv_2026-09_A03~1", "menunggu", "trx-inv_2026-09_A03~1", AKUN],
    );
  });

  it("kos tanpa sub-akun Xendit: gateway sungguhan ditolak (uang tidak boleh masuk ke akun Kostera); simulasi tetap jalan", async () => {
    await db.update(schema.organizations).set({ xenditAkunId: null }).where(eq(schema.organizations.id, "org_kos_melati"));
    const { gateway, permintaan } = gatewayUji();
    await gagalDengan(buatTransaksiBayar(db, TOKEN_A03, "qris", { gateway, sekarang: SEKARANG }), 409, new RegExp(GALAT_BELUM_AKTIF.slice(0, 30)));
    assert.equal(permintaan.length, 0);

    const simulasi = await buatTransaksiBayar(db, TOKEN_A03, "qris", { gateway: getGatewayPembayaran({}), sekarang: SEKARANG });
    assert.match(simulasi.qrString!, /SIMULASI/);
    assert.equal((await transaksiDari("inv_2026-09_A03"))[0].akunGateway, null);
  });

  it("sub-akun kos diganti / dulu mode contoh → VA lama tidak dipakai ulang, dibuat baru ke sub-akun yang sekarang", async () => {
    const simulasi = await buatTransaksiBayar(db, TOKEN_A03, "va_bca", { gateway: getGatewayPembayaran({}), sekarang: SEKARANG });
    const { gateway, permintaan } = gatewayUji();
    const pertama = await buatTransaksiBayar(db, TOKEN_A03, "va_bca", { gateway, sekarang: SEKARANG });
    assert.notEqual(pertama.nomorVa, simulasi.nomorVa);
    const AKUN_BARU = "6a34caaa8a9c47963f1b7abc";
    await db.update(schema.organizations).set({ xenditAkunId: AKUN_BARU }).where(eq(schema.organizations.id, "org_kos_melati"));
    await buatTransaksiBayar(db, TOKEN_A03, "va_bca", { gateway, sekarang: SEKARANG });
    assert.deepEqual(permintaan.map((p) => p.akunId), [AKUN, AKUN_BARU]);
    const akun = (await transaksiDari("inv_2026-09_A03")).sort((a, b) => a.percobaan - b.percobaan).map((t) => t.akunGateway);
    assert.deepEqual(akun, [null, AKUN, AKUN_BARU]);
  });

  it("batas nominal metode: sisa Rp5.000 tidak bisa lewat VA BCA (min Rp10.000), bisa lewat QRIS", async () => {
    // C09 sudah masuk Rp750.000 dari Rp800.000 → naikkan jadi Rp795.000 supaya sisa Rp5.000.
    await db.update(schema.payments).set({ nominalDibayar: 795_000 }).where(eq(schema.payments.invoiceId, "inv_2026-09_C09"));
    const { gateway, permintaan } = gatewayUji();
    await gagalDengan(buatTransaksiBayar(db, "demo-c09-2026-09", "va_bca", { gateway, sekarang: SEKARANG }), 400, /minimal Rp10\.000/);
    assert.equal(permintaan.length, 0);
    assert.equal((await buatTransaksiBayar(db, "demo-c09-2026-09", "qris", { gateway, sekarang: SEKARANG })).nominal, 5_000);
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
    it("diotorisasi = menunggu dibayar (bukan uang masuk); berhasil → Lunas & transaksi berhasil; ulang = duplikat", async () => {
      const { gateway } = gatewayUji();
      await buatTransaksiBayar(db, TOKEN_A03, "va_bca", { gateway, sekarang: SEKARANG });
      const order = "inv_2026-09_A03~1";

      assert.deepEqual(await prosesNotifikasiPembayaran(db, notif(order, "AUTHORIZED", 500_000)), {
        duplikat: false,
        hasil: "menunggu pembayaran",
        invoiceId: "inv_2026-09_A03",
        statusInvoice: "menunggu",
      });
      const saatPending = await getInvoicePublik(db, TOKEN_A03);
      assert.deepEqual([saatPending?.pembayaran, saatPending?.bisaDibayar], [[], true]);

      const lunas = await prosesNotifikasiPembayaran(db, notif(order, "SUCCEEDED", 500_000));
      assert.equal(!lunas.duplikat && lunas.statusInvoice, "lunas");
      assert.deepEqual(await prosesNotifikasiPembayaran(db, notif(order, "SUCCEEDED", 500_000)), { duplikat: true });
      const [t] = await transaksiDari("inv_2026-09_A03");
      assert.equal(t.status, "berhasil");
      const inv = await getInvoicePublik(db, TOKEN_A03);
      assert.deepEqual([inv?.status, inv?.sisa, inv?.pembayaran.map((p) => [p.metode, p.status])], ["lunas", 0, [["VA BCA", "valid"]]]);

      // Notifikasi kedaluwarsa yang terlambat tidak menimpa transaksi yang sudah berhasil.
      await prosesNotifikasiPembayaran(db, notif(order, "EXPIRED", 500_000));
      assert.equal((await transaksiDari("inv_2026-09_A03"))[0].status, "berhasil");
    });

    it("kedaluwarsa → kedaluwarsa, gagal → gagal; tagihan tetap bisa dibayar", async () => {
      const { gateway } = gatewayUji();
      await buatTransaksiBayar(db, TOKEN_A03, "qris", { gateway, sekarang: SEKARANG });
      await buatTransaksiBayar(db, TOKEN_A03, "va_bca", { gateway, sekarang: SEKARANG });
      await prosesNotifikasiPembayaran(db, notif("inv_2026-09_A03~1", "EXPIRED", 500_000));
      await prosesNotifikasiPembayaran(db, notif("inv_2026-09_A03~2", "FAILED", 500_000));
      const status = (await transaksiDari("inv_2026-09_A03")).sort((a, b) => a.percobaan - b.percobaan).map((t) => t.status);
      assert.deepEqual(status, ["kedaluwarsa", "gagal"]);
      assert.equal((await getInvoicePublik(db, TOKEN_A03))?.bisaDibayar, true);
    });
  });
});
