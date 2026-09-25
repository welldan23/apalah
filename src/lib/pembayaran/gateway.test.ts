import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getGatewayPembayaran } from "./gateway.ts";
import { buatGatewayMidtrans } from "./midtrans.ts";
import type { IdMetodeBayar } from "./metode.ts";

type Panggilan = { url: string; init: RequestInit };

function fetchPalsu(balasan: Record<string, unknown>, status = 200) {
  const panggilan: Panggilan[] = [];
  const f = (async (url: string, init: RequestInit) => {
    panggilan.push({ url, init });
    return Response.json(balasan, { status });
  }) as unknown as typeof fetch;
  return { f, panggilan };
}

const permintaan = (metode: IdMetodeBayar, masaBerlakuMenit = 1440) => ({
  orderId: "inv_2026-09_A05~1",
  nominal: 500_000,
  metode,
  masaBerlakuMenit,
});

const PENDING = { status_code: "201", transaction_status: "pending", transaction_id: "trx-123", expiry_time: "2026-09-25 10:15:00" };

describe("gateway Midtrans (POST /v2/charge)", () => {
  it("QRIS: sandbox, Basic auth server key, masa berlaku sesuai metode; instruksi berisi isi QR", async () => {
    const { f, panggilan } = fetchPalsu({ ...PENDING, payment_type: "qris", qr_string: "00020101021226..." });
    const gateway = buatGatewayMidtrans({ serverKey: "SB-Mid-server-uji", fetch: f });
    const hasil = await gateway.buatTransaksi(permintaan("qris", 15));
    assert.deepEqual(hasil, {
      referensi: "trx-123",
      kedaluwarsaPada: new Date("2026-09-25T10:15:00+07:00"),
      qrString: "00020101021226...",
    });
    const [{ url, init }] = panggilan;
    assert.equal(url, "https://api.sandbox.midtrans.com/v2/charge");
    assert.equal((init.headers as Record<string, string>).Authorization, `Basic ${Buffer.from("SB-Mid-server-uji:").toString("base64")}`);
    assert.deepEqual(JSON.parse(init.body as string), {
      transaction_details: { order_id: "inv_2026-09_A05~1", gross_amount: 500_000 },
      custom_expiry: { expiry_duration: 15, unit: "minute" },
      payment_type: "qris",
      qris: { acquirer: "gopay" },
    });
    assert.deepEqual([gateway.provider, gateway.simulasi], ["midtrans", false]);
  });

  it("VA bank: nomor VA dari va_numbers (BCA/BNI/BRI) atau permata_va_number; produksi ke api.midtrans.com", async () => {
    const bca = fetchPalsu({ ...PENDING, va_numbers: [{ bank: "bca", va_number: "12345678901" }] });
    const hasilBca = await buatGatewayMidtrans({ serverKey: "k", produksi: true, fetch: bca.f }).buatTransaksi(permintaan("va_bca"));
    assert.equal(hasilBca.nomorVa, "12345678901");
    assert.equal(bca.panggilan[0].url, "https://api.midtrans.com/v2/charge");
    const body = JSON.parse(bca.panggilan[0].init.body as string);
    assert.deepEqual([body.payment_type, body.bank_transfer], ["bank_transfer", { bank: "bca" }]);

    const permata = fetchPalsu({ ...PENDING, permata_va_number: "8562000123" });
    const hasilPermata = await buatGatewayMidtrans({ serverKey: "k", fetch: permata.f }).buatTransaksi(permintaan("va_permata"));
    assert.equal(hasilPermata.nomorVa, "8562000123");
    assert.deepEqual(JSON.parse(permata.panggilan[0].init.body as string).bank_transfer, { bank: "permata" });
  });

  it("VA Mandiri = Mandiri Bill: kode bayar + kode perusahaan", async () => {
    const { f, panggilan } = fetchPalsu({ ...PENDING, bill_key: "990000000260", biller_code: "70012" });
    const hasil = await buatGatewayMidtrans({ serverKey: "k", fetch: f }).buatTransaksi(permintaan("va_mandiri"));
    assert.deepEqual([hasil.nomorVa, hasil.kodePerusahaan], ["990000000260", "70012"]);
    assert.equal(JSON.parse(panggilan[0].init.body as string).payment_type, "echannel");
  });

  it("ditolak gateway atau respons tidak lengkap → Error berisi pesan gateway", async () => {
    const ditolak = fetchPalsu({ status_code: "406", status_message: "Duplicate order ID" });
    await assert.rejects(buatGatewayMidtrans({ serverKey: "k", fetch: ditolak.f }).buatTransaksi(permintaan("va_bni")), /Midtrans 406: Duplicate order ID/);
    const tanpaVa = fetchPalsu({ ...PENDING });
    await assert.rejects(buatGatewayMidtrans({ serverKey: "k", fetch: tanpaVa.f }).buatTransaksi(permintaan("va_bni")), /Midtrans 201/);
    const galatServer = fetchPalsu({}, 500);
    await assert.rejects(buatGatewayMidtrans({ serverKey: "k", fetch: galatServer.f }).buatTransaksi(permintaan("qris")), /Midtrans 500/);
  });
});

describe("getGatewayPembayaran", () => {
  it("tanpa MIDTRANS_SERVER_KEY → simulasi: instruksi contoh yang tetap per order", async () => {
    const gateway = getGatewayPembayaran({});
    assert.deepEqual([gateway.provider, gateway.simulasi], ["simulasi", true]);
    const a = await gateway.buatTransaksi(permintaan("va_bri"));
    const b = await gateway.buatTransaksi(permintaan("va_bri"));
    assert.match(a.nomorVa!, /^8808\d{12}$/);
    assert.equal(a.nomorVa, b.nomorVa);
    assert.equal((await gateway.buatTransaksi(permintaan("va_mandiri"))).kodePerusahaan, "70012");
    assert.match((await gateway.buatTransaksi(permintaan("qris", 15))).qrString!, /SIMULASI/);
  });

  it("dengan MIDTRANS_SERVER_KEY → Midtrans", () => {
    assert.deepEqual([getGatewayPembayaran({ MIDTRANS_SERVER_KEY: "k" }).provider, getGatewayPembayaran({ MIDTRANS_SERVER_KEY: "k" }).simulasi], ["midtrans", false]);
  });
});
