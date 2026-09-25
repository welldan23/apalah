import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { and, eq, gte, lt } from "drizzle-orm";

import type { Db } from "../../db/index.ts";
import * as schema from "../../db/schema.ts";
import { isiDataContoh } from "../../db/seed.ts";
import { buatDbUji } from "../../db/testing.ts";
import type { PengirimWhatsApp, PesanWhatsApp } from "../whatsapp/index.ts";
import { parseKataKunci, validasiIntent } from "./intent.ts";
import { kodeAksi } from "./kode-aksi.ts";
import { prosesPesanKosta } from "./proses-pesan.ts";
import { simpanPesanMasuk } from "./terima-pesan.ts";

const ORG = "org_kos_melati";
const OWNER = "6281234567890";
const HARI_INI = "2026-09-24"; // Kamis → minggu ini mulai Senin 21 Sep
const SEKARANG = new Date("2026-09-24T09:00:00+07:00");

describe("Kosta: prepare_reminder per kamar & get_income_summary mingguan", () => {
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

  async function chat(teks: string) {
    const [masuk] = await simpanPesanMasuk(db, [
      { idProvider: `wamid.p.${++urutan}`, dari: OWNER, teks, waktu: new Date(SEKARANG.getTime() + urutan * 1000) },
    ]);
    const balasan = await prosesPesanKosta(db, { conversationId: masuk.conversationId, messageId: masuk.messageId, teks, saluran: "whatsapp" }, deps);
    const [audit] = await db.select().from(schema.kostaAuditLogs).where(eq(schema.kostaAuditLogs.idPesanMasuk, masuk.messageId));
    return { balasan, audit, wa: terkirim.at(-1)! };
  }
  const nomorPenyewa = async (kamar: string) =>
    (await db.select().from(schema.tenants).where(eq(schema.tenants.id, `tnt_${kamar}`)))[0].nomorWa;

  beforeEach(async () => {
    ({ db, tutup } = await buatDbUji());
    await isiDataContoh(db);
    terkirim.length = 0;
  });
  afterEach(() => tutup());

  it("parser: kamar yang disebut ikut ke intent reminder; 'minggu ini' → rekap mingguan", () => {
    assert.deepEqual(parseKataKunci("Kirim reminder ke kamar A01, A03, B02", HARI_INI), {
      intent: "siapkan_reminder",
      kamar: ["A01", "A03", "B02"],
    });
    assert.deepEqual(parseKataKunci("siapkan reminder buat yang menunggak", HARI_INI), { intent: "siapkan_reminder" });
    assert.deepEqual(parseKataKunci("Rekap pemasukan minggu ini", HARI_INI), { intent: "rekap_pemasukan", rentang: "minggu_ini" });
    assert.deepEqual(validasiIntent({ intent: "siapkan_reminder", kamar: ["a 5", "A05", 7, "zz"] }), { intent: "siapkan_reminder", kamar: ["A05"] });
    assert.deepEqual(validasiIntent({ intent: "rekap_pemasukan", rentang: "tahun_ini" }), { intent: "rekap_pemasukan" });
  });

  it("reminder ke kamar tertentu: preview jelas (kos, total, dampak, kode) → hanya kamar itu yang dikirimi setelah YA + kode", async () => {
    // A05 jatuh tempo, A06 menunggu (belum jatuh tempo), A03 sudah diingatkan 23 Sep 09.00 (< 24 jam).
    const draft = await chat("kirim reminder ke kamar A05, A06, A03");
    const lampiran = draft.balasan.lampiran;
    assert.equal(lampiran?.jenis, "preview_aksi");
    if (lampiran?.jenis !== "preview_aksi") return;
    assert.deepEqual(lampiran.penerima.map((p) => p.nomorKamar), ["A05", "A06"]);
    assert.match(draft.balasan.teks, /^Ini preview pengingat untuk kamar A05, A06, total Rp[\d.]+\. Belum ada pesan yang dikirim sampai kamu konfirmasi\. Kamar A03 dilewati/);
    assert.match(draft.wa.teks, /\*Preview Pengingat September 2026 — Kos Melati\*/);
    assert.match(draft.wa.teks, /Dampak: pesan WhatsApp berisi nominal & link invoice dikirim ke 2 penyewa\./);
    const kode = kodeAksi(lampiran.draftId!);
    assert.match(draft.wa.teks, new RegExp(`Balas \\*YA ${kode}\\*`));
    assert.deepEqual(
      [draft.audit.intent, draft.audit.hasil, draft.audit.actionId, draft.audit.payload],
      ["prepare_reminder", "menunggu_konfirmasi", lampiran.draftId, { kamar: ["A05", "A06", "A03"] }],
    );
    assert.equal(terkirim.length, 1); // baru balasan preview ke owner

    const ok = await chat(`YA ${kode}`);
    assert.equal(ok.balasan.teks, "Pengingat terkirim ke 2 penyewa.");
    const penerima = terkirim.filter((p) => p.ke !== OWNER).map((p) => p.ke).sort();
    assert.deepEqual(penerima, [await nomorPenyewa("A05"), await nomorPenyewa("A06")].sort());
  });

  it("kamar yang tidak ada / tanpa tagihan belum dibayar → tanya ulang, tidak ada draft", async () => {
    const jumlahDraft = async () => (await db.select().from(schema.actionDrafts)).length;
    const sebelum = await jumlahDraft();
    const tidakAda = await chat("kirim reminder ke kamar Z99, A05");
    assert.equal(tidakAda.balasan.teks, "Kamar Z99 tidak ada di kos ini. Cek lagi nomor kamarnya, ya.");
    const lunas = await chat("kirim reminder ke kamar A01");
    assert.match(lunas.balasan.teks, /^Tidak ada tagihan yang perlu diingatkan untuk kamar A01/);
    assert.equal(await jumlahDraft(), sebelum);
    assert.equal(terkirim.filter((p) => p.ke !== OWNER).length, 0);
  });

  it("rekap pemasukan minggu ini = pembayaran valid terverifikasi Senin–hari ini, hanya kos aktif", async () => {
    // Satu pembayaran pasti di minggu ini, satu lagi Minggu lalu (tidak dihitung).
    await db.insert(schema.payments).values([
      { invoiceId: "inv_2026-09_A06", nominalDibayar: 123_000, metode: "QRIS", provider: "midtrans", referensiProvider: "uji-minggu-ini", status: "valid", diverifikasiPada: new Date("2026-09-22T10:00:00+07:00") },
      { invoiceId: "inv_2026-09_A06", nominalDibayar: 77_000, metode: "QRIS", provider: "midtrans", referensiProvider: "uji-minggu-lalu", status: "valid", diverifikasiPada: new Date("2026-09-20T23:00:00+07:00") },
    ]);
    const [harapan] = await db
      .select({ jumlah: schema.payments.nominalDibayar })
      .from(schema.payments)
      .innerJoin(schema.invoices, eq(schema.invoices.id, schema.payments.invoiceId))
      .where(
        and(
          eq(schema.invoices.organizationId, ORG),
          eq(schema.payments.status, "valid"),
          gte(schema.payments.diverifikasiPada, new Date("2026-09-21T00:00:00+07:00")),
          lt(schema.payments.diverifikasiPada, new Date("2026-09-25T00:00:00+07:00")),
        ),
      )
      .then((baris) => [{ total: baris.reduce((t, b) => t + b.jumlah, 0), n: baris.length }]);

    assert.ok(harapan.n >= 1 && harapan.total >= 123_000);

    const { balasan, audit } = await chat("rekap pemasukan minggu ini");
    assert.equal(balasan.lampiran?.jenis, "rekap");
    if (balasan.lampiran?.jenis !== "rekap") return;
    assert.equal(balasan.lampiran.judul, "Pemasukan minggu ini (21 Sep–24 Sep)");
    assert.deepEqual(balasan.lampiran.baris, [{ label: "Sudah masuk", nominal: harapan.total, catatan: `${harapan.n} pembayaran` }]);
    assert.deepEqual([audit.intent, audit.payload], ["get_income_summary", { rentang: "minggu_ini" }]);
  });
});
