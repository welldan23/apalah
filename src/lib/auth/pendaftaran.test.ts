import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { eq } from "drizzle-orm";

import type { Db } from "../../db/index.ts";
import * as schema from "../../db/schema.ts";
import { isiDataContoh } from "../../db/seed.ts";
import { buatDbUji } from "../../db/testing.ts";
import type { PengirimWhatsApp, PesanWhatsApp } from "../whatsapp/index.ts";
import { pesanGalatAuth } from "./klien.ts";
import { buatAuth } from "./index.ts";
import { GALAT_KIRIM_OTP, kirimOtpLewatWa } from "./otp-wa.ts";

const BASE = "http://localhost:3000";

function waUji(gagal = false) {
  const terkirim: PesanWhatsApp[] = [];
  const wa: PengirimWhatsApp = {
    provider: "uji",
    simulasi: false,
    async kirim(pesan) {
      terkirim.push(pesan);
      return gagal ? { ok: false, galat: "nomor tidak terdaftar di WhatsApp" } : { ok: true };
    },
  };
  return { wa, terkirim };
}

describe("endpoint pendaftaran nomor WhatsApp (POST /api/auth/phone-number/send-otp)", () => {
  let db: Db;
  let tutup: () => Promise<void>;
  const kirimOtp = (auth: ReturnType<typeof buatAuth>, phoneNumber: string, ip = "10.0.0.1") =>
    auth.handler(
      new Request(`${BASE}/api/auth/phone-number/send-otp`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: BASE, "x-forwarded-for": ip },
        body: JSON.stringify({ phoneNumber }),
      }),
    );
  const buat = (wa: PengirimWhatsApp, batasPermintaan = false) =>
    buatAuth(db, { secret: "rahasia-uji-yang-cukup-panjang-untuk-better-auth", baseURL: BASE, kirimOtp: kirimOtpLewatWa(wa, db), batasPermintaan });

  before(async () => {
    ({ db, tutup } = await buatDbUji());
    await isiDataContoh(db);
  });
  after(() => tutup());

  it("kode 6 digit dikirim lewat WhatsApp (teks + template resmi) dan disimpan sekali pakai", async () => {
    const { wa, terkirim } = waUji();
    const res = await kirimOtp(buat(wa), "6281299990001");
    assert.equal(res.status, 200);
    const [pesan] = terkirim;
    const kode = /Kode verifikasi Kostera kamu: (\d{6})\. Berlaku 5 menit\./.exec(pesan.teks)?.[1];
    assert.ok(kode);
    assert.equal(pesan.ke, "6281299990001");
    assert.deepEqual(pesan.template, { nama: "kostera_kode_otp", bahasa: "id", variabel: [kode], tombolUrl: kode });
    const [otp] = await db.select().from(schema.verifications).where(eq(schema.verifications.identifier, "6281299990001"));
    assert.equal(otp.value, `${kode}:0`);
    // Log kiriman hanya metadata: kode OTP tidak tersimpan di kolom mana pun.
    const [log] = await db.select().from(schema.whatsappLogs).where(eq(schema.whatsappLogs.tujuan, "6281299990001"));
    assert.deepEqual(
      [log.jenis, log.organizationId, log.referensiId, log.provider, log.template, log.status],
      ["otp", null, null, "uji", "kostera_kode_otp", "terkirim"],
    );
    assert.ok(!JSON.stringify(log).includes(kode));
  });

  it("nomor yang bukan format 628… ditolak tanpa mengirim apa pun", async () => {
    const { wa, terkirim } = waUji();
    for (const nomor of ["0812-9999-0002", "+6281299990002", "12345"]) {
      const res = await kirimOtp(buat(wa), nomor);
      assert.equal(res.status, 400, nomor);
      assert.equal(((await res.json()) as { code: string }).code, "INVALID_PHONE_NUMBER");
    }
    assert.equal(terkirim.length, 0);
  });

  it("WhatsApp gagal → 503 dengan pesan yang jelas untuk pendaftar", async () => {
    const res = await kirimOtp(buat(waUji(true).wa), "6281299990003");
    assert.equal(res.status, 503);
    const data = (await res.json()) as { code: string; message: string };
    assert.deepEqual(data, { code: "OTP_GAGAL_TERKIRIM", message: GALAT_KIRIM_OTP });
    assert.equal(pesanGalatAuth(res.status, data.code, data.message), GALAT_KIRIM_OTP);
    const [log] = await db.select().from(schema.whatsappLogs).where(eq(schema.whatsappLogs.tujuan, "6281299990003"));
    assert.deepEqual([log.jenis, log.status, log.galat], ["otp", "gagal", "nomor tidak terdaftar di WhatsApp"]);
  });

  it("dibatasi 5 permintaan per 10 menit per IP (biaya WhatsApp & anti-spam)", async () => {
    const { wa, terkirim } = waUji();
    const auth = buat(wa, true);
    const status: number[] = [];
    for (let i = 0; i < 6; i++) status.push((await kirimOtp(auth, `628129999100${i}`, "10.0.0.9")).status);
    assert.deepEqual(status, [200, 200, 200, 200, 200, 429]);
    assert.equal(terkirim.length, 5);
    // IP lain tidak ikut terhambat.
    assert.equal((await kirimOtp(auth, "6281299991009", "10.0.0.10")).status, 200);
    assert.match(pesanGalatAuth(429), /Terlalu sering/);
  });

  it("pesan galat Better Auth diterjemahkan untuk pengguna", () => {
    assert.equal(pesanGalatAuth(400, "INVALID_OTP", "Invalid OTP"), "Kode salah. Cek lagi pesan WhatsApp-nya.");
    assert.equal(pesanGalatAuth(400, "OTP_EXPIRED"), "Kode sudah kedaluwarsa. Minta kode baru.");
    assert.equal(pesanGalatAuth(500, undefined, "Internal Server Error"), "Terjadi kesalahan. Coba lagi sebentar lagi.");
  });
});
