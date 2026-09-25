import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { eq } from "drizzle-orm";

import type { Db } from "../../db/index.ts";
import * as schema from "../../db/schema.ts";
import { isiDataContoh } from "../../db/seed.ts";
import { buatDbUji } from "../../db/testing.ts";
import type { PengirimWhatsApp, PesanWhatsApp } from "../whatsapp/index.ts";
import { kodeAksi } from "./kode-aksi.ts";
import { prosesPesanKosta } from "./proses-pesan.ts";
import { simpanPesanMasuk } from "./terima-pesan.ts";

const NOMOR_OWNER = "6281234567890";

describe("prosesPesanKosta (WhatsApp)", () => {
  let db: Db;
  let tutup: () => Promise<void>;
  const terkirim: PesanWhatsApp[] = [];
  const wa: PengirimWhatsApp = {
    provider: "uji",
    simulasi: false,
    async kirim(pesan) {
      terkirim.push(pesan);
      return { ok: true };
    },
  };
  const deps = { wa, llm: null, baseUrl: "https://kostera.id", hariIni: "2026-09-24", sekarang: new Date("2026-09-24T09:00:00+07:00") };
  let urutan = 0;

  /** Owner mengirim pesan WA → disimpan seperti dari webhook → diproses Kosta. */
  async function chat(teks: string, nomor = NOMOR_OWNER) {
    const [masuk] = await simpanPesanMasuk(db, [
      { idProvider: `wamid.${++urutan}`, dari: nomor, teks, waktu: new Date(Date.UTC(2026, 8, 24, 2, urutan)) },
    ]);
    const balasan = await prosesPesanKosta(db, { conversationId: masuk.conversationId, messageId: masuk.messageId, teks, saluran: "whatsapp" }, deps);
    return { balasan, wa: terkirim.at(-1)!, messageId: masuk.messageId };
  }

  before(async () => {
    ({ db, tutup } = await buatDbUji());
    await isiDataContoh(db);
  });
  after(() => tutup());

  it("pertanyaan tunggakan → balasan dari database, lampiran di riwayat, teks WA berformat", async () => {
    const { balasan, wa: kirim, messageId } = await chat("Kosta, berapa tunggakan bulan ini?");
    assert.equal(balasan.dari, "kosta");
    assert.equal(balasan.lampiran?.jenis, "daftar_tagihan");
    assert.equal(kirim.ke, NOMOR_OWNER);
    assert.match(kirim.teks, /\*Tunggakan per 24 Sep 2026\*\n• A05 Rizky Ramadhan — Rp500\.000 \(lewat 9 hari\)/);
    const [masuk] = await db.select().from(schema.waMessages).where(eq(schema.waMessages.id, messageId));
    assert.equal(masuk.intent, "lihat_tunggakan");
  });

  it("\"YA <kode>\" menyetujui preview pengingat yang menunggu; \"ya\" lagi tidak menjalankan apa pun", async () => {
    const sebelum = terkirim.length;
    const { balasan } = await chat(`ya ${kodeAksi("draft_reminder_2026-09")}`);
    assert.equal(balasan.teks, "Pengingat terkirim ke 3 penyewa.");
    assert.equal(terkirim.length - sebelum, 4); // 3 pengingat ke penyewa + 1 balasan ke owner
    assert.equal((await chat("ya")).balasan.teks, "Tidak ada preview yang sedang menunggu konfirmasi.");
  });

  it("draft tagihan → koreksi → batal, semua lewat chat", async () => {
    const draft = await chat("buat tagihan bulan depan");
    assert.equal(draft.balasan.lampiran?.jenis, "preview_aksi");
    const kode = kodeAksi(draft.balasan.lampiran?.jenis === "preview_aksi" ? draft.balasan.lampiran.draftId! : "");
    assert.match(draft.wa.teks, new RegExp(`Balas \\*YA ${kode}\\* untuk buat, \\*BATAL ${kode}\\* untuk membatalkan, atau koreksi`));

    const koreksi = await chat("kecualikan A05");
    assert.match(koreksi.balasan.teks, /^Draft diperbarui \(A05 dikecualikan\)\. Sekarang 33 penghuni/);

    assert.equal((await chat("kecualikan A07")).balasan.teks, "Kamar A07 tidak ada di draft ini.");
    assert.equal((await chat("batal")).balasan.teks, "Oke, dibatalkan. Tidak ada yang dikirim atau diubah.");
  });

  it("ganti kos → daftar kos → pilih nomor; data kos lain tidak terbaca", async () => {
    assert.match((await chat("ganti kos")).balasan.teks, /^Kamu mengelola beberapa kos\.[\s\S]*1\. Griya Asri[\s\S]*2\. Kos Mawar[\s\S]*3\. Kos Melati/);
    assert.match((await chat("kamar kosong ada berapa")).balasan.teks, /^Kamu mengelola beberapa kos/);
    assert.equal((await chat("2")).balasan.teks, "Oke, sekarang aku bantu untuk Kos Mawar (12 kamar). Data kos lain tidak ikut dibaca.");
    assert.match((await chat("kamar kosong ada berapa")).balasan.teks, /^Belum ada kamar yang terdaftar/);
    await chat("ganti kos");
    await chat("melati");
    assert.match((await chat("rekap pemasukan")).balasan.teks, /^Ini rekap pemasukan bulan berjalan/);
  });

  it("pesan di luar kemampuan → bantuan; nomor asing tidak mendapat data", async () => {
    assert.match((await chat("cuaca hari ini gimana")).balasan.teks, /^Aku Kosta, asisten kos kamu/);
    const asing = await chat("berapa tunggakan bulan ini?", "6285700000001");
    assert.match(asing.balasan.teks, /^Nomor ini belum terdaftar di Kostera/);
    assert.equal(asing.balasan.lampiran, undefined);
    assert.equal(asing.wa.ke, "6285700000001");
  });
});
