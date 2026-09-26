import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getGatewayPembayaran, type PermintaanTransaksi } from "./gateway.ts";
import type { IdMetodeBayar } from "./metode.ts";
import { buatGatewayXendit, namaPenerimaVa } from "./xendit.ts";

type Panggilan = { url: string; init: RequestInit };

function fetchPalsu(balasan: Record<string, unknown>, status = 201) {
  const panggilan: Panggilan[] = [];
  const f = (async (url: string, init: RequestInit) => {
    panggilan.push({ url, init });
    return Response.json(balasan, { status });
  }) as unknown as typeof fetch;
  return { f, panggilan };
}

const AKUN = "5cafeb170a2b18519b1b8761";

const permintaan = (metode: IdMetodeBayar, masaBerlakuMenit = 1440): PermintaanTransaksi => ({
  orderId: "inv_2026-09_A05~1",
  nominal: 500_000,
  metode,
  masaBerlakuMenit,
  akunId: AKUN,
  namaPenerima: "Kos Melati",
});

const aksi = (descriptor: string, value: string) => ({ type: "PRESENT_TO_CUSTOMER", descriptor, value });
const DIBUAT = { payment_request_id: "pr-123", status: "REQUIRES_ACTION", channel_properties: { expires_at: "2026-09-25T03:15:00Z" } };

describe("gateway Xendit (POST /v3/payment_requests)", () => {
  it("QRIS: atas nama sub-akun kos (for-user-id), api-version, Basic auth; instruksi berisi isi QR", async () => {
    const { f, panggilan } = fetchPalsu({ ...DIBUAT, actions: [aksi("QR_STRING", "00020101021226...")] });
    const gateway = buatGatewayXendit({ secretKey: "xnd_development_uji", fetch: f });
    const sebelum = Date.now();
    const hasil = await gateway.buatTransaksi(permintaan("qris", 15));
    assert.deepEqual(hasil, { referensi: "pr-123", kedaluwarsaPada: new Date("2026-09-25T03:15:00Z"), qrString: "00020101021226..." });

    const [{ url, init }] = panggilan;
    assert.equal(url, "https://api.xendit.co/v3/payment_requests");
    const header = init.headers as Record<string, string>;
    assert.equal(header.Authorization, `Basic ${Buffer.from("xnd_development_uji:").toString("base64")}`);
    assert.deepEqual([header["api-version"], header["for-user-id"]], ["2024-11-11", AKUN]);
    const body = JSON.parse(init.body as string);
    const batas = Date.parse(body.channel_properties.expires_at) - sebelum;
    assert.ok(batas >= 15 * 60_000 - 1000 && batas <= 15 * 60_000 + 5000, "expires_at = 15 menit");
    assert.deepEqual({ ...body, channel_properties: Object.keys(body.channel_properties) }, {
      reference_id: "inv_2026-09_A05~1",
      type: "PAY",
      country: "ID",
      currency: "IDR",
      request_amount: 500_000,
      capture_method: "AUTOMATIC",
      channel_code: "QRIS",
      channel_properties: ["expires_at"],
      description: "Pembayaran sewa kos",
    });
    assert.deepEqual([gateway.provider, gateway.simulasi], ["xendit", false]);
  });

  it("Virtual Account: channel per bank, nama kos tampil sebagai penerima; nomor VA dari actions", async () => {
    for (const [metode, channel] of [
      ["va_bca", "BCA_VIRTUAL_ACCOUNT"],
      ["va_bni", "BNI_VIRTUAL_ACCOUNT"],
      ["va_bri", "BRI_VIRTUAL_ACCOUNT"],
      ["va_mandiri", "MANDIRI_VIRTUAL_ACCOUNT"],
      ["va_permata", "PERMATA_VIRTUAL_ACCOUNT"],
    ] as const) {
      const { f, panggilan } = fetchPalsu({ ...DIBUAT, actions: [aksi("VIRTUAL_ACCOUNT_NUMBER", "381659999912345")] });
      const hasil = await buatGatewayXendit({ secretKey: "k", fetch: f }).buatTransaksi({ ...permintaan(metode), namaPenerima: "Kos Melati & Co (Depok)" });
      assert.equal(hasil.nomorVa, "381659999912345");
      const body = JSON.parse(panggilan[0].init.body as string);
      assert.deepEqual([body.channel_code, body.channel_properties.display_name], [channel, "Kos Melati Co Depok"]);
    }
  });

  it("tanpa expires_at di respons → batas dihitung sendiri", async () => {
    const { f } = fetchPalsu({ payment_request_id: "pr-9", actions: [aksi("QR_STRING", "QR")] });
    const sebelum = Date.now();
    const hasil = await buatGatewayXendit({ secretKey: "k", fetch: f }).buatTransaksi(permintaan("qris", 15));
    assert.ok(hasil.kedaluwarsaPada.getTime() >= sebelum + 15 * 60_000);
  });

  it("ditolak, respons tidak lengkap, atau tanpa sub-akun kos → Error (tanpa memanggil Xendit bila tanpa sub-akun)", async () => {
    const ditolak = fetchPalsu({ error_code: "API_VALIDATION_ERROR", message: "request_amount is invalid" }, 400);
    await assert.rejects(
      buatGatewayXendit({ secretKey: "k", fetch: ditolak.f }).buatTransaksi(permintaan("va_bni")),
      /Xendit 400: API_VALIDATION_ERROR — request_amount is invalid/,
    );
    const tanpaVa = fetchPalsu({ ...DIBUAT, actions: [] });
    await assert.rejects(buatGatewayXendit({ secretKey: "k", fetch: tanpaVa.f }).buatTransaksi(permintaan("va_bni")), /Xendit 201: respons tidak lengkap/);
    const qrUntukVa = fetchPalsu({ ...DIBUAT, actions: [aksi("QR_STRING", "QR")] });
    await assert.rejects(buatGatewayXendit({ secretKey: "k", fetch: qrUntukVa.f }).buatTransaksi(permintaan("va_bca")), /respons tidak lengkap/);

    const tanpaAkun = fetchPalsu(DIBUAT);
    await assert.rejects(
      buatGatewayXendit({ secretKey: "k", fetch: tanpaAkun.f }).buatTransaksi({ ...permintaan("qris"), akunId: undefined }),
      /sub-akun kos belum diatur/,
    );
    assert.equal(tanpaAkun.panggilan.length, 0);
  });

  it("nama penerima VA hanya huruf/angka/spasi/.,' — kosong jadi 'Kostera'", () => {
    assert.equal(namaPenerimaVa("  Kos 'Bu Sri', Jl. Mawar #3  "), "Kos 'Bu Sri', Jl. Mawar 3");
    assert.equal(namaPenerimaVa("🏠🏠"), "Kostera");
    assert.equal(namaPenerimaVa(undefined), "Kostera");
    assert.equal(namaPenerimaVa("A".repeat(60)).length, 40);
  });
});

describe("getGatewayPembayaran", () => {
  it("tanpa XENDIT_SECRET_KEY → simulasi: instruksi contoh yang tetap per order", async () => {
    const gateway = getGatewayPembayaran({});
    assert.deepEqual([gateway.provider, gateway.simulasi], ["simulasi", true]);
    const a = await gateway.buatTransaksi(permintaan("va_bri"));
    const b = await gateway.buatTransaksi(permintaan("va_bri"));
    assert.match(a.nomorVa!, /^8808\d{12}$/);
    assert.equal(a.nomorVa, b.nomorVa);
    assert.match((await gateway.buatTransaksi(permintaan("va_mandiri"))).nomorVa!, /^8808\d{12}$/);
    assert.match((await gateway.buatTransaksi(permintaan("qris", 15))).qrString!, /SIMULASI/);
  });

  it("dengan XENDIT_SECRET_KEY → Xendit", () => {
    const gateway = getGatewayPembayaran({ XENDIT_SECRET_KEY: "xnd_development_uji" });
    assert.deepEqual([gateway.provider, gateway.simulasi], ["xendit", false]);
  });
});
