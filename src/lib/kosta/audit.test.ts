import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, it } from "node:test";

import { and, desc, eq } from "drizzle-orm";

import type { Db } from "../../db/index.ts";
import * as schema from "../../db/schema.ts";
import { isiDataContoh } from "../../db/seed.ts";
import { buatDbUji } from "../../db/testing.ts";
import type { PengirimWhatsApp, PesanWhatsApp } from "../whatsapp/index.ts";
import { saringPayload } from "./audit.ts";
import { prosesPesanKosta } from "./proses-pesan.ts";
import { toolTunggakan } from "./tool-baca.ts";
import { terimaWebhookWhatsApp } from "./webhook-masuk.ts";

// Nilai uji saja — bukan rahasia sungguhan.
const RAHASIA = "rahasia-webhook-uji";
const HARI_INI = "2026-09-24";
const OWNER = "6281234567890"; // Ratna: owner Kos Melati & Kos Mawar, admin Griya Asri
const OWNER_GRIYA = "6281377009900"; // Hendra: owner Griya Asri saja
const NOMOR_ASING = "6285700000001";

/** Payload WAHA satu pesan teks, beserta header tanda tangan HMAC SHA-512. */
function kirimanWaha(id: string, dari: string, teks: string, rahasia = RAHASIA) {
  const isi = Buffer.from(
    JSON.stringify({ event: "message", payload: { id, from: `${dari}@c.us`, body: teks, fromMe: false, timestamp: 1790200000 } }),
  );
  const headers = new Headers({ "x-webhook-hmac": createHmac("sha512", rahasia).update(isi).digest("hex") });
  return { isi, headers };
}

describe("Kosta: webhook WhatsApp, identitas nomor, list_arrears & audit", () => {
  let db: Db;
  let tutup: () => Promise<void>;
  const terkirim: PesanWhatsApp[] = [];
  const wa: PengirimWhatsApp = {
    provider: "uji",
    simulasi: true,
    async kirim(pesan) {
      terkirim.push(pesan);
      return { ok: true };
    },
  };
  const deps = { wa, llm: null, baseUrl: "https://kostera.id", hariIni: HARI_INI };
  let urutan = 0;

  /** Pesan WA lewat webhook bertanda tangan → diproses Kosta seperti di route. */
  async function chat(teks: string, dari = OWNER) {
    const { isi, headers } = kirimanWaha(`wamid.uji.${++urutan}`, dari, teks);
    const hasil = await terimaWebhookWhatsApp(db, { isi, headers, rahasia: RAHASIA });
    assert.equal(hasil.http, 200);
    const [masuk] = hasil.baru;
    const balasan = await prosesPesanKosta(db, { conversationId: masuk.conversationId, messageId: masuk.messageId, teks, saluran: "whatsapp" }, deps);
    const [audit] = await db
      .select()
      .from(schema.kostaAuditLogs)
      .where(eq(schema.kostaAuditLogs.idPesanMasuk, masuk.messageId));
    return { balasan, audit, messageId: masuk.messageId };
  }

  beforeEach(async () => {
    ({ db, tutup } = await buatDbUji());
    await isiDataContoh(db);
    terkirim.length = 0;
  });
  afterEach(() => tutup());

  describe("webhook", () => {
    const eventTerakhir = async () =>
      (await db.select().from(schema.waWebhookEvents).orderBy(desc(schema.waWebhookEvents.dibuatPada)).limit(1))[0];
    const jumlahPesanMasuk = async () =>
      (await db.select().from(schema.waMessages).where(eq(schema.waMessages.arah, "masuk"))).length;

    it("bertanda tangan valid → pesan tersimpan & event tercatat tanpa isi pesan maupun nomor", async () => {
      const sebelum = await jumlahPesanMasuk();
      const { isi, headers } = kirimanWaha("wamid.A1", NOMOR_ASING, "halo kosta, tunggakan berapa?");
      const hasil = await terimaWebhookWhatsApp(db, { isi, headers, rahasia: RAHASIA });
      assert.deepEqual([hasil.http, hasil.body], [200, { diterima: 1, baru: 1 }]);
      assert.equal(await jumlahPesanMasuk(), sebelum + 1);
      const e = await eventTerakhir();
      assert.deepEqual(
        [e.provider, e.status, e.jumlahPesan, e.pesanBaru, e.idPesanProvider],
        ["waha", "diterima", 1, 1, ["wamid.A1"]],
      );
      assert.ok(!JSON.stringify(e).includes(NOMOR_ASING) && !JSON.stringify(e).includes("tunggakan"));
    });

    it("kiriman ulang ID pesan yang sama → tidak tersimpan/diproses dua kali, tercatat sebagai duplikat", async () => {
      const kiriman = kirimanWaha("wamid.DUP", OWNER, "tunggakan bulan ini");
      await terimaWebhookWhatsApp(db, { ...kiriman, rahasia: RAHASIA });
      const sebelum = await jumlahPesanMasuk();
      const ulang = await terimaWebhookWhatsApp(db, { ...kiriman, rahasia: RAHASIA });
      assert.deepEqual([ulang.http, ulang.body, ulang.baru.length], [200, { diterima: 1, baru: 0 }, 0]);
      assert.equal(await jumlahPesanMasuk(), sebelum);
      const e = await eventTerakhir();
      assert.deepEqual([e.status, e.jumlahPesan, e.pesanBaru], ["diterima", 1, 0]);
    });

    it("tanda tangan salah, tanpa rahasia, JSON rusak, atau terlalu besar → ditolak, tidak ada pesan tersimpan", async () => {
      const sebelum = await jumlahPesanMasuk();
      const palsu = kirimanWaha("wamid.X", OWNER, "tunggakan", "rahasia-lain");
      assert.equal((await terimaWebhookWhatsApp(db, { ...palsu, rahasia: RAHASIA })).http, 401);
      assert.equal((await eventTerakhir()).status, "tanda_tangan_invalid");

      const sah = kirimanWaha("wamid.Y", OWNER, "tunggakan");
      assert.equal((await terimaWebhookWhatsApp(db, { ...sah, rahasia: undefined })).http, 401);

      const rusak = Buffer.from("{bukan json");
      const headers = new Headers({ "x-webhook-hmac": createHmac("sha512", RAHASIA).update(rusak).digest("hex") });
      assert.equal((await terimaWebhookWhatsApp(db, { isi: rusak, headers, rahasia: RAHASIA })).http, 400);
      assert.equal((await eventTerakhir()).status, "payload_invalid");

      const besar = kirimanWaha("wamid.Z", OWNER, "x".repeat(600 * 1024));
      assert.equal((await terimaWebhookWhatsApp(db, { ...besar, rahasia: RAHASIA })).http, 413);
      assert.equal(await jumlahPesanMasuk(), sebelum);
      assert.equal(terkirim.length, 0);
    });
  });

  describe("identitas nomor & isolasi organisasi", () => {
    it("nomor asing (termasuk nomor penyewa) → balasan aman tanpa data kos; tercatat ditolak tanpa aktor/kos", async () => {
      const penyewaA05 = (await db.select().from(schema.tenants).where(eq(schema.tenants.id, "tnt_A05")))[0].nomorWa;
      for (const nomor of [NOMOR_ASING, penyewaA05]) {
        const { balasan, audit } = await chat("siapa yang belum bayar bulan ini?", nomor);
        assert.match(balasan.teks, /^Nomor ini belum terdaftar di Kostera/);
        assert.equal(balasan.lampiran, undefined);
        assert.doesNotMatch(balasan.teks, /Rp|Melati|Mawar|Griya|A0\d|Rizky/);
        assert.deepEqual(
          [audit.statusPengirim, audit.hasil, audit.organizationId, audit.actorUserId, audit.intent, audit.saluran],
          ["tidak_dikenal", "ditolak", null, null, null, "whatsapp"],
        );
      }
    });

    it("list_arrears: jawaban deterministik dari database untuk kos aktif, tercatat di audit", async () => {
      const { balasan, audit, messageId } = await chat("Siapa yang belum bayar bulan ini?");
      const dariDb = await toolTunggakan(db, "org_kos_melati", { hariIni: HARI_INI });
      assert.equal(balasan.teks, dariDb.teks);
      assert.deepEqual(balasan.lampiran, dariDb.lampiran);
      assert.deepEqual(
        [audit.statusPengirim, audit.organizationId, audit.actorUserId, audit.intent, audit.tool, audit.hasil, audit.idPesanMasuk],
        ["siap", "org_kos_melati", "usr_ratna", "list_arrears", "lihat_tunggakan", "dijawab", messageId],
      );
      // Payload audit hanya parameter intent — bukan isi pesan.
      assert.ok(Object.keys(audit.payload).every((k) => k === "periode"));
      assert.ok(!JSON.stringify(audit).includes("belum bayar"));
    });

    it("owner multi-kos: ganti kos → diminta memilih (tanpa data) → pilih → data hanya dari kos terpilih", async () => {
      const ganti = await chat("ganti kos");
      assert.equal(ganti.audit.intent, "switch_organization");
      assert.equal(ganti.audit.hasil, "klarifikasi");

      const belumPilih = await chat("siapa yang belum bayar?");
      assert.match(belumPilih.balasan.teks, /^Kamu mengelola beberapa kos/);
      assert.equal(belumPilih.balasan.lampiran, undefined);
      assert.deepEqual(
        [belumPilih.audit.statusPengirim, belumPilih.audit.hasil, belumPilih.audit.organizationId],
        ["pilih_workspace", "klarifikasi", null],
      );

      const pilih = await chat("2");
      assert.match(pilih.balasan.teks, /Kos Mawar/);
      assert.deepEqual([pilih.audit.intent, pilih.audit.organizationId], ["select_organization", "org_kos_mawar"]);

      const mawar = await chat("siapa yang belum bayar?");
      assert.equal(mawar.audit.organizationId, "org_kos_mawar");
      assert.doesNotMatch(mawar.balasan.teks + JSON.stringify(mawar.balasan.lampiran ?? {}), /Rizky|A05|B15/);
    });

    it("dua kos dengan tunggakan masing-masing: tiap owner hanya melihat miliknya", async () => {
      // Tunggakan di Griya Asri (kos milik Hendra; Ratna hanya admin di sana).
      await db.insert(schema.rooms).values({ id: "room_G01", organizationId: "org_griya_asri", nomorKamar: "G01", tipe: "Standar", hargaSewa: 700_000, status: "terisi" });
      await db.insert(schema.tenants).values({
        id: "tnt_G01", organizationId: "org_griya_asri", nama: "Sari Griya", nomorWa: "6281377005566",
        roomId: "room_G01", tanggalMasuk: "2026-01-10", hargaSewa: 700_000,
      });
      await db.insert(schema.invoices).values({
        id: "inv_G01", organizationId: "org_griya_asri", tenantId: "tnt_G01", roomId: "room_G01",
        periode: "2026-09", nominal: 700_000, jatuhTempo: "2026-09-10", status: "jatuh_tempo", tokenPublik: "uji-g01-2026-09",
      });

      const griya = await chat("siapa yang belum bayar?", OWNER_GRIYA);
      const teksGriya = griya.balasan.teks + JSON.stringify(griya.balasan.lampiran ?? {});
      assert.match(teksGriya, /G01/);
      assert.doesNotMatch(teksGriya, /Rizky|A05|B15|Melati/);
      assert.deepEqual([griya.audit.organizationId, griya.audit.actorUserId], ["org_griya_asri", "usr_pemilik_griya"]);

      const melati = await chat("siapa yang belum bayar?");
      assert.doesNotMatch(melati.balasan.teks + JSON.stringify(melati.balasan.lampiran ?? {}), /G01|Sari Griya/);
      const auditGriya = await db.select().from(schema.kostaAuditLogs).where(and(eq(schema.kostaAuditLogs.organizationId, "org_griya_asri")));
      assert.ok(auditGriya.every((a) => a.actorUserId === "usr_pemilik_griya"));
    });
  });

  it("saringPayload hanya menyimpan parameter intent yang dikenal, terpotong", () => {
    assert.deepEqual(
      saringPayload({ intent: "lihat_tunggakan", periode: "2026-09", teks: "rahasia", nomorWa: "6281", kecualikan: ["A05", "x".repeat(80)] }),
      { periode: "2026-09", kecualikan: ["A05", "x".repeat(40)] },
    );
  });
});
