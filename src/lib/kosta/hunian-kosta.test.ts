import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { eq, inArray } from "drizzle-orm";

import type { Db } from "../../db/index.ts";
import * as schema from "../../db/schema.ts";
import { isiDataContoh } from "../../db/seed.ts";
import { buatDbUji } from "../../db/testing.ts";
import type { PengirimWhatsApp, PesanWhatsApp } from "../whatsapp/index.ts";
import { parseKataKunci } from "./intent.ts";
import { kodeAksi } from "./kode-aksi.ts";
import { prosesPesanKosta } from "./proses-pesan.ts";
import { simpanPesanMasuk } from "./terima-pesan.ts";

const OWNER = "6281234567890";
const OWNER_GRIYA = "6281377009900";
const HARI_INI = "2026-09-24";
const SEKARANG = new Date("2026-09-24T09:00:00+07:00");

describe("Kosta: prepare_tenant_move (pindah kamar & penghuni keluar)", () => {
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
  const deps = { wa, llm: null, baseUrl: "https://kostera.id", hariIni: HARI_INI, sekarang: SEKARANG };
  let urutan = 0;

  async function chat(teks: string, dari = OWNER) {
    const [masuk] = await simpanPesanMasuk(db, [
      { idProvider: `wamid.h.${++urutan}`, dari, teks, waktu: new Date(SEKARANG.getTime() + urutan * 1000) },
    ]);
    const balasan = await prosesPesanKosta(db, { conversationId: masuk.conversationId, messageId: masuk.messageId, teks, saluran: "whatsapp" }, deps);
    const [audit] = await db.select().from(schema.kostaAuditLogs).where(eq(schema.kostaAuditLogs.idPesanMasuk, masuk.messageId));
    return { balasan, audit, wa: terkirim.at(-1)! };
  }
  const kodeDari = (b: Awaited<ReturnType<typeof chat>>["balasan"]) =>
    kodeAksi(b.lampiran?.jenis === "preview_aksi" ? b.lampiran.draftId! : "");
  const kamar = async (...nomor: string[]) =>
    Object.fromEntries(
      (await db.select().from(schema.rooms).where(inArray(schema.rooms.nomorKamar, nomor)))
        .filter((r) => r.organizationId === "org_kos_melati")
        .map((r) => [r.nomorKamar, r.status]),
    );
  const penghuni = async (id: string) => (await db.select().from(schema.tenants).where(eq(schema.tenants.id, id)))[0];
  const jumlahDraft = async () => (await db.select().from(schema.actionDrafts)).length;

  beforeEach(async () => {
    ({ db, tutup } = await buatDbUji());
    await isiDataContoh(db);
    terkirim.length = 0;
  });
  afterEach(() => tutup());

  it("parser: pindah dengan/ tanpa tujuan, keluar, dan tanggal", () => {
    assert.deepEqual(parseKataKunci("Penghuni B04 pindah akhir bulan", HARI_INI), { intent: "pindah_penghuni", dariKamar: "B04", tanggal: "2026-09-30" });
    assert.deepEqual(parseKataKunci("B04 pindah ke B05", HARI_INI), { intent: "pindah_penghuni", dariKamar: "B04", keKamar: "B05" });
    assert.deepEqual(parseKataKunci("A05 keluar tgl 20", HARI_INI), { intent: "keluar_penghuni", nomorKamar: "A05", tanggal: "2026-09-20" });
    assert.deepEqual(parseKataKunci("B04 pindah keluar 30 sep", HARI_INI), { intent: "keluar_penghuni", nomorKamar: "B04", tanggal: "2026-09-30" });
  });

  it("\"Penghuni B04 pindah akhir bulan\" (ambigu & tanggal belum tiba) → Kosta bertanya, tidak ada draft", async () => {
    const sebelum = await jumlahDraft();
    const { balasan, audit } = await chat("Penghuni B04 pindah akhir bulan");
    assert.match(balasan.teks, /^Maksudnya penghuni B04 pindah ke kamar lain, atau keluar dari kos\?/);
    assert.match(balasan.teks, /dicatat saat hari-H \(30 Sep 2026\)/);
    assert.equal(balasan.lampiran, undefined);
    assert.equal(await jumlahDraft(), sebelum);
    assert.deepEqual([audit.intent, audit.hasil, audit.payload], ["prepare_tenant_move", "klarifikasi", { dariKamar: "B04", tanggal: "2026-09-30" }]);

    const besok = await chat("B04 pindah ke B05 besok");
    assert.match(besok.balasan.teks, /tidak bisa dijadwalkan dulu/);
    assert.equal(await jumlahDraft(), sebelum);
  });

  it("pindah kamar: preview (tidak mengubah data) → YA + kode → penghuni pindah, kamar asal kosong", async () => {
    const draft = await chat("B04 pindah ke B05");
    assert.match(draft.balasan.teks, /^Ini preview pindah kamar untuk .+: B04 → B05 per 24 Sep 2026\. Sewa tetap Rp650\.000/);
    assert.match(draft.wa.teks, /\*Preview Pindah Kamar September 2026 — Kos Melati\*/);
    assert.match(draft.wa.teks, /Dampak: data penghuni pindah ke kamar tujuan, kamar asal jadi kosong/);
    assert.deepEqual([draft.audit.intent, draft.audit.hasil], ["prepare_tenant_move", "menunggu_konfirmasi"]);
    assert.deepEqual(await kamar("B04", "B05"), { B04: "terisi", B05: "kosong" });

    const kode = kodeDari(draft.balasan);
    assert.equal((await chat("ya")).balasan.teks, `Supaya tidak salah aksi, balas dengan kodenya: *YA ${kode}* untuk menjalankan, atau *BATAL ${kode}*.`);
    assert.deepEqual(await kamar("B04", "B05"), { B04: "terisi", B05: "kosong" });

    const ok = await chat(`YA ${kode}`);
    assert.match(ok.balasan.teks, /sudah dipindah dari B04 ke B05 per 24 Sep 2026\. Sewa Rp650\.000\/bulan/);
    assert.deepEqual(await kamar("B04", "B05"), { B04: "kosong", B05: "terisi" });
    const b05 = (await db.select().from(schema.rooms).where(eq(schema.rooms.nomorKamar, "B05")))[0];
    assert.equal((await penghuni("tnt_B04")).roomId, b05.id);
    assert.deepEqual([ok.audit.hasil, ok.audit.statusKonfirmasi], ["dijalankan", "dijalankan"]);
    // Tidak ada pesan ke penyewa untuk aksi hunian.
    assert.ok(terkirim.every((p) => p.ke === OWNER));
  });

  it("kamar tujuan keburu terisi sebelum dikonfirmasi → tidak jadi dijalankan, data tidak berubah", async () => {
    const draft = await chat("B04 pindah ke B05");
    await db.update(schema.rooms).set({ status: "terisi" }).where(eq(schema.rooms.nomorKamar, "B05"));
    const hasil = await chat(`ya ${kodeDari(draft.balasan)}`);
    assert.equal(hasil.balasan.teks, "Tidak jadi dijalankan: Kamar B05 sudah terisi. Tidak ada data yang diubah.");
    assert.deepEqual([hasil.audit.hasil, hasil.audit.statusKonfirmasi], ["ditolak", "dibatalkan"]);
    assert.equal((await penghuni("tnt_B04")).status, "aktif");
    assert.equal((await kamar("B04")).B04, "terisi");
  });

  it("tujuan tidak ada / terisi → tanya ulang tanpa draft", async () => {
    const sebelum = await jumlahDraft();
    assert.equal((await chat("B04 pindah ke Z99")).balasan.teks, "Kamar Z99 tidak ada di kos ini. Cek lagi nomor kamarnya, ya.");
    assert.equal((await chat("B04 pindah ke A05")).balasan.teks, "Kamar A05 sudah terisi. Pilih kamar kosong lain.");
    assert.equal((await chat("B05 pindah ke A07")).balasan.teks, "Tidak ada penghuni aktif di kamar B05. Cek lagi nomor kamarnya, ya.");
    assert.equal(await jumlahDraft(), sebelum);
  });

  it("penghuni keluar: preview menyebut tunggakan yang tetap tercatat → YA + kode → kamar kosong, tagihan tetap ada", async () => {
    const draft = await chat("A05 keluar hari ini");
    assert.match(draft.balasan.teks, /^Ini preview penghuni keluar: Rizky Ramadhan dari A05 per 24 Sep 2026\. 1 tagihan belum lunas \(Rp500\.000\) tetap tercatat/);
    assert.equal((await penghuni("tnt_A05")).status, "aktif");

    const ok = await chat(`YA ${kodeDari(draft.balasan)}`);
    assert.match(ok.balasan.teks, /^Rizky Ramadhan tercatat keluar dari A05 per 24 Sep 2026\. Kamar A05 sekarang kosong\. 1 tagihan belum lunas \(Rp500\.000\) tetap tercatat\./);
    assert.equal((await penghuni("tnt_A05")).status, "keluar");
    assert.equal((await kamar("A05")).A05, "kosong");
    const [inv] = await db.select().from(schema.invoices).where(eq(schema.invoices.id, "inv_2026-09_A05"));
    assert.equal(inv.status, "jatuh_tempo");
  });

  it("isolasi: owner kos lain tidak bisa memindah/mengeluarkan penghuni Kos Melati", async () => {
    const sebelum = await jumlahDraft();
    const { balasan, audit } = await chat("A05 keluar hari ini", OWNER_GRIYA);
    assert.equal(balasan.teks, "Tidak ada penghuni aktif di kamar A05. Cek lagi nomor kamarnya, ya.");
    assert.equal(audit.organizationId, "org_griya_asri");
    assert.equal(await jumlahDraft(), sebelum);
    assert.equal((await penghuni("tnt_A05")).status, "aktif");
  });
});
