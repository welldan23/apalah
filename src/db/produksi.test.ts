import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";

import { getPengirimWhatsApp } from "../lib/whatsapp/index.ts";
import { periksaDataContoh, periksaEnvProduksi } from "./cek-produksi.ts";
import { pastikanBukanPgliteDiProduksi } from "./index.ts";
import { isiDataContoh } from "./seed.ts";
import { buatDbUji } from "./testing.ts";

// Nilai uji saja — bukan rahasia sungguhan.
const ENV_SEHAT = {
  DATABASE_URL: "postgresql://kostera:uji-db-rahasia@db.contoh.id:6543/postgres",
  APP_URL: "https://app.kostera.id",
  LANDING_URL: "https://kostera.id",
  BETTER_AUTH_SECRET: "b".repeat(40),
  WHATSAPP_PROVIDER: "meta",
  META_WA_TOKEN: "token-meta-uji-rahasia",
  META_WA_PHONE_NUMBER_ID: "1234567890",
  WHATSAPP_WEBHOOK_SECRET: "w".repeat(40),
  WHATSAPP_VERIFY_TOKEN: "verifikasi-uji",
  CRON_SECRET: "c".repeat(64),
  XENDIT_SECRET_KEY: "xnd_production_uji-rahasia",
  XENDIT_WEBHOOK_TOKEN: "token-webhook-xendit-uji-rahasia",
  LLM_API_KEY: "kunci-llm-uji-rahasia",
};

describe("cek:produksi", () => {
  it("konfigurasi produksi yang sehat: tanpa galat & peringatan; nilai rahasia tidak pernah ikut dilaporkan", () => {
    assert.deepEqual(periksaEnvProduksi(ENV_SEHAT), { galat: [], peringatan: [] });
    const buruk = periksaEnvProduksi({ ...ENV_SEHAT, WHATSAPP_PROVIDER: "waha", BETTER_AUTH_SECRET: "pendek-rahasia", CRON_SECRET: "cron-pendek-rahasia" });
    const teks = JSON.stringify(buruk);
    for (const rahasia of ["uji-db-rahasia", "pendek-rahasia", "cron-pendek-rahasia", "token-meta-uji-rahasia", "xnd_production_uji-rahasia", "token-webhook-xendit-uji-rahasia"]) {
      assert.ok(!teks.includes(rahasia), rahasia);
    }
  });

  it("menolak PGlite, WAHA, provider log, http, secret pendek, dan kunci Xendit yang salah / tanpa token webhook", () => {
    const galat = (env: Record<string, string | undefined>) => periksaEnvProduksi({ ...ENV_SEHAT, ...env }).galat.join("\n");
    assert.match(galat({ DATABASE_URL: undefined }), /DATABASE_URL/);
    assert.match(galat({ WHATSAPP_PROVIDER: "waha" }), /WAHA hanya untuk pilot internal/);
    assert.match(galat({ WHATSAPP_PROVIDER: undefined }), /wajib "meta"/);
    assert.match(galat({ META_WA_TOKEN: undefined }), /META_WA_TOKEN/);
    assert.match(galat({ WAHA_IZINKAN_SEMUA_NOMOR: "true" }), /WAHA_IZINKAN_SEMUA_NOMOR/);
    assert.match(galat({ APP_URL: "http://app.kostera.id" }), /https/);
    assert.match(galat({ LANDING_URL: "http://kostera.id" }), /LANDING_URL harus alamat https/);
    assert.match(galat({ LANDING_URL: "https://app.kostera.id" }), /LANDING_URL harus beda domain/);
    assert.match(periksaEnvProduksi({ ...ENV_SEHAT, LANDING_URL: undefined }).peringatan.join("\n"), /LANDING_URL kosong/);
    assert.match(galat({ BETTER_AUTH_SECRET: "pendek" }), /BETTER_AUTH_SECRET/);
    assert.match(galat({ BETTER_AUTH_URL: "https://kostera.id" }), /BETTER_AUTH_URL/);
    assert.match(galat({ CRON_SECRET: "pendek" }), /CRON_SECRET/);
    assert.match(galat({ XENDIT_SECRET_KEY: "xnd_public_production_uji" }), /bukan secret key Xendit/);
    assert.match(galat({ XENDIT_WEBHOOK_TOKEN: undefined }), /XENDIT_WEBHOOK_TOKEN wajib/);
    const test = periksaEnvProduksi({ ...ENV_SEHAT, XENDIT_SECRET_KEY: "xnd_development_uji" });
    assert.deepEqual([test.galat, test.peringatan], [[], ["Xendit mode TEST (xnd_development_…): pembayaran penyewa bukan uang sungguhan."]]);
  });

  it("yang belum disiapkan (cron, Xendit, LLM) jadi peringatan, bukan galat", () => {
    const hasil = periksaEnvProduksi({
      ...ENV_SEHAT,
      CRON_SECRET: undefined,
      XENDIT_SECRET_KEY: undefined,
      XENDIT_WEBHOOK_TOKEN: undefined,
      LLM_API_KEY: undefined,
    });
    assert.deepEqual(hasil.galat, []);
    assert.equal(hasil.peringatan.length, 3);
    assert.match(hasil.peringatan.join("\n"), /cron.*401/);
  });

  it("WhatsApp first: webhook WhatsApp tanpa secret / verify token Meta = galat, bukan sekadar peringatan", () => {
    assert.match(periksaEnvProduksi({ ...ENV_SEHAT, WHATSAPP_WEBHOOK_SECRET: undefined }).galat.join("\n"), /WHATSAPP_WEBHOOK_SECRET wajib/);
    assert.match(periksaEnvProduksi({ ...ENV_SEHAT, WHATSAPP_VERIFY_TOKEN: undefined }).galat.join("\n"), /WHATSAPP_VERIFY_TOKEN wajib/);
  });

  it("mode pilot WAHA: boleh hanya dengan KOSTERA_MODE=pilot, daftar nomor owner, API key, dan https", () => {
    const pilot = {
      ...ENV_SEHAT,
      KOSTERA_MODE: "pilot",
      WHATSAPP_PROVIDER: "waha",
      WAHA_URL: "https://waha.contoh.id",
      WAHA_API_KEY: "kunci-waha-uji-rahasia",
      WHATSAPP_NOMOR_UJI: "0812-3456-7890, 6281377009900",
      WHATSAPP_VERIFY_TOKEN: undefined,
      META_WA_TOKEN: undefined,
      META_WA_PHONE_NUMBER_ID: undefined,
    };
    const sehat = periksaEnvProduksi(pilot);
    assert.deepEqual(sehat.galat, []);
    assert.match(sehat.peringatan.join("\n"), /Mode pilot WAHA/);
    assert.ok(!JSON.stringify(sehat).includes("kunci-waha-uji-rahasia"));

    const galat = (env: Record<string, string | undefined>) => periksaEnvProduksi({ ...pilot, ...env }).galat.join("\n");
    assert.match(galat({ KOSTERA_MODE: undefined }), /WAHA hanya untuk pilot internal/);
    assert.match(galat({ KOSTERA_MODE: "demo" }), /KOSTERA_MODE hanya boleh/);
    assert.match(galat({ WHATSAPP_NOMOR_UJI: undefined }), /wajib WHATSAPP_NOMOR_UJI/);
    assert.match(galat({ WHATSAPP_NOMOR_UJI: "bukan-nomor" }), /wajib WHATSAPP_NOMOR_UJI/);
    assert.match(galat({ WAHA_API_KEY: undefined }), /WAHA_API_KEY wajib/);
    assert.match(galat({ WAHA_URL: "http://waha.contoh.id" }), /WAHA_URL wajib alamat https/);
    assert.match(galat({ WAHA_URL: undefined }), /WAHA_URL wajib alamat https/);
    assert.equal(galat({ WAHA_URL: "http://localhost:3000" }), "");
    assert.match(galat({ WAHA_IZINKAN_SEMUA_NOMOR: "true" }), /WAHA_IZINKAN_SEMUA_NOMOR/);
    assert.match(galat({ WHATSAPP_WEBHOOK_SECRET: undefined }), /WHATSAPP_WEBHOOK_SECRET wajib/);
  });

  it("data contoh di database terdeteksi", async () => {
    const { db, tutup } = await buatDbUji();
    try {
      assert.deepEqual(await periksaDataContoh(db), []);
      await isiDataContoh(db);
      assert.equal((await periksaDataContoh(db)).length, 1);
    } finally {
      await tutup();
    }
  });
});

describe("pengaman produksi", () => {
  it("produksi tanpa DATABASE_URL ditolak (tidak diam-diam memakai PGlite); pengembangan tetap boleh", () => {
    assert.throws(() => pastikanBukanPgliteDiProduksi({ NODE_ENV: "production" }), /DATABASE_URL wajib/);
    assert.doesNotThrow(() => pastikanBukanPgliteDiProduksi({ NODE_ENV: "production", DATABASE_URL: "postgresql://db/kostera" }));
    assert.doesNotThrow(() => pastikanBukanPgliteDiProduksi({}));
    assert.doesNotThrow(() => pastikanBukanPgliteDiProduksi({ NODE_ENV: "development" }));
  });

  it("npm run db:seed menolak jalan di produksi sebelum menyentuh database", () => {
    const hasil = spawnSync(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "src/db/seed.ts"], {
      // Alamat yang sengaja tidak bisa dihubungi: bila penjaga jebol, galatnya berbeda.
      env: { ...process.env, NODE_ENV: "production", DATABASE_URL: "postgresql://uji:uji@127.0.0.1:9/tidak_ada" },
      encoding: "utf8",
      timeout: 60_000,
    });
    assert.equal(hasil.status, 1);
    assert.match(hasil.stderr, /Data contoh tidak boleh diisikan di produksi/);
  });

  it("provider log di produksi tidak mencatat isi pesan (kode OTP) maupun nomor lengkap", async (t) => {
    const catatan: string[] = [];
    t.mock.method(console, "info", (teks: string) => catatan.push(teks));
    const semula = process.env.NODE_ENV;
    const env = process.env as Record<string, string | undefined>;
    try {
      env.NODE_ENV = "production";
      await getPengirimWhatsApp({}).kirim({ ke: "6281234567890", teks: "Kode verifikasi Kostera kamu: 482913. Berlaku 5 menit." });
      env.NODE_ENV = "development";
      await getPengirimWhatsApp({}).kirim({ ke: "6281234567890", teks: "Kode verifikasi Kostera kamu: 482913." });
    } finally {
      // Menetapkan undefined ke process.env menghasilkan string "undefined" — hapus bila semula kosong.
      if (semula === undefined) delete env.NODE_ENV;
      else env.NODE_ENV = semula;
    }
    assert.equal(catatan.length, 2);
    assert.ok(!catatan[0].includes("482913") && !catatan[0].includes("6281234567890"), catatan[0]);
    assert.match(catatan[0], /isi tidak dicatat/);
    // Pengembangan lokal tetap menampilkan kodenya supaya bisa masuk tanpa WhatsApp sungguhan.
    assert.match(catatan[1], /482913/);
  });
});
