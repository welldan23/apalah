import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { and, eq, inArray } from "drizzle-orm";

import type { Db } from "../../db/index.ts";
import * as schema from "../../db/schema.ts";
import { isiDataContoh } from "../../db/seed.ts";
import { buatDbUji } from "../../db/testing.ts";
import { GalatAksi } from "../aksi/galat.ts";
import type { PengirimWhatsApp, PesanWhatsApp } from "../whatsapp/index.ts";
import { siapkanDraftReminder } from "./draft.ts";
import { ALAT, parseCepat } from "./intent.ts";
import { kedaluwarsakanDraftDanCatat, putuskanDraftDariDashboard } from "./keputusan.ts";
import { kodeAksi } from "./kode-aksi.ts";
import { prosesPesanKosta, TOLAK_TANDAI_LUNAS } from "./proses-pesan.ts";
import { simpanPesanMasuk } from "./terima-pesan.ts";

const ORG = "org_kos_melati";
const OWNER = "6281234567890";
const OWNER_GRIYA = "6281377009900";
// Draft contoh (seed): preview pengingat 3 penunggak, dibuat 24 Sep 08.10 WIB.
const DRAFT_CONTOH = "draft_reminder_2026-09";
const SEKARANG = new Date("2026-09-24T09:00:00+07:00");

describe("Kosta: konfirmasi aksi dengan kode, kedaluwarsa, dan batas status bayar", () => {
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
  const deps = { wa, llm: null, baseUrl: "https://kostera.id", hariIni: "2026-09-24", sekarang: SEKARANG };
  let urutan = 0;
  /** Pesan ke penyewa (selain balasan ke owner). */
  const kePenyewa = () => terkirim.filter((p) => p.ke !== OWNER && p.ke !== OWNER_GRIYA).length;

  async function chat(teks: string, dari = OWNER) {
    const [masuk] = await simpanPesanMasuk(db, [
      { idProvider: `wamid.k.${++urutan}`, dari, teks, waktu: new Date(SEKARANG.getTime() + urutan * 1000) },
    ]);
    const balasan = await prosesPesanKosta(db, { conversationId: masuk.conversationId, messageId: masuk.messageId, teks, saluran: "whatsapp" }, deps);
    const [audit] = await db.select().from(schema.kostaAuditLogs).where(eq(schema.kostaAuditLogs.idPesanMasuk, masuk.messageId));
    return { balasan, audit, conversationId: masuk.conversationId };
  }
  const statusDraft = async (id: string) =>
    (await db.select({ s: schema.actionDrafts.status }).from(schema.actionDrafts).where(eq(schema.actionDrafts.id, id)))[0].s;

  beforeEach(async () => {
    ({ db, tutup } = await buatDbUji());
    await isiDataContoh(db);
    terkirim.length = 0;
  });
  afterEach(() => tutup());

  it("parser: YA/BATAL + kode 6 digit; kata biasa tidak dianggap kode", () => {
    assert.deepEqual(parseCepat("YA 482913"), { intent: "konfirmasi", setuju: true, kode: "482913" });
    assert.deepEqual(parseCepat("setuju #482913"), { intent: "konfirmasi", setuju: true, kode: "482913" });
    assert.deepEqual(parseCepat("batal 482913"), { intent: "konfirmasi", setuju: false, kode: "482913" });
    assert.deepEqual(parseCepat("ya kirim"), { intent: "konfirmasi", setuju: true });
    assert.equal(kodeAksi(DRAFT_CONTOH), kodeAksi(DRAFT_CONTOH));
    assert.match(kodeAksi("3f2a"), /^\d{6}$/);
  });

  it("\"ya\" tanpa kode tidak menjalankan apa pun — Kosta meminta kode aksinya", async () => {
    const kode = kodeAksi(DRAFT_CONTOH);
    const { balasan, audit } = await chat("ya");
    assert.equal(balasan.teks, `Supaya tidak salah aksi, balas dengan kodenya: *YA ${kode}* untuk menjalankan, atau *BATAL ${kode}*.`);
    assert.equal(kePenyewa(), 0);
    assert.equal(await statusDraft(DRAFT_CONTOH), "menunggu_konfirmasi");
    assert.deepEqual([audit.intent, audit.hasil, audit.actionId], ["confirm_action", "klarifikasi", DRAFT_CONTOH]);
  });

  it("YA + kode yang benar menjalankan tepat sekali; kode yang sama lagi ditolak tanpa kirim ulang", async () => {
    const kode = kodeAksi(DRAFT_CONTOH);
    const salah = await chat("ya 000000");
    assert.equal(salah.balasan.teks, "Kode aksi 000000 tidak ditemukan. Cek lagi kodenya di preview terakhir.");
    assert.equal(salah.audit.hasil, "ditolak");
    assert.equal(kePenyewa(), 0);

    const ok = await chat(`YA ${kode}`);
    assert.equal(ok.balasan.teks, "Pengingat terkirim ke 3 penyewa.");
    assert.equal(kePenyewa(), 3);
    assert.deepEqual(
      [ok.audit.intent, ok.audit.actionId, ok.audit.statusKonfirmasi, ok.audit.hasil, ok.audit.payload],
      ["confirm_action", DRAFT_CONTOH, "dijalankan", "dijalankan", { setuju: true, kode }],
    );

    const ulang = await chat(`ya ${kode}`);
    assert.equal(ulang.balasan.teks, `Aksi ${kode} sudah dijalankan sebelumnya, jadi tidak dijalankan lagi.`);
    assert.equal(kePenyewa(), 3);
    assert.deepEqual([ulang.audit.hasil, ulang.audit.statusKonfirmasi], ["ditolak", "dijalankan"]);
  });

  it("kode aksi dari percakapan/kos lain tidak cocok", async () => {
    const lain = await chat(`ya ${kodeAksi(DRAFT_CONTOH)}`, OWNER_GRIYA);
    assert.match(lain.balasan.teks, /tidak ditemukan/);
    assert.equal(kePenyewa(), 0);
    assert.equal(await statusDraft(DRAFT_CONTOH), "menunggu_konfirmasi");
  });

  it("preview lewat 24 jam tidak bisa dijalankan: dibatalkan, tercatat kedaluwarsa", async () => {
    await db
      .update(schema.actionDrafts)
      .set({ dibuatPada: new Date(SEKARANG.getTime() - 25 * 3_600_000) })
      .where(eq(schema.actionDrafts.id, DRAFT_CONTOH));
    const { balasan, audit } = await chat(`ya ${kodeAksi(DRAFT_CONTOH)}`);
    assert.match(balasan.teks, /lebih dari 24 jam/);
    assert.equal(kePenyewa(), 0);
    assert.equal(await statusDraft(DRAFT_CONTOH), "dibatalkan");
    assert.deepEqual([audit.statusKonfirmasi, audit.hasil], ["kedaluwarsa", "dibatalkan"]);
  });

  it("cron membatalkan preview yang menunggu > 24 jam dan mencatatnya; preview baru tidak tersentuh", async () => {
    const baru = await siapkanDraftReminder(db, { organizationId: ORG, userId: "usr_ratna" });
    const jumlah = await kedaluwarsakanDraftDanCatat(db, new Date("2026-09-25T09:00:00+07:00"));
    assert.equal(jumlah, 1);
    assert.equal(await statusDraft(DRAFT_CONTOH), "dibatalkan");
    assert.equal(await statusDraft(baru!.draftId!), "menunggu_konfirmasi");
    const [audit] = await db.select().from(schema.kostaAuditLogs).where(eq(schema.kostaAuditLogs.actionId, DRAFT_CONTOH));
    assert.deepEqual(
      [audit.saluran, audit.intent, audit.statusKonfirmasi, audit.hasil, audit.organizationId],
      ["sistem", "expire_action", "kedaluwarsa", "dibatalkan", ORG],
    );
  });

  it("keputusan dari dashboard tercatat; putusan ganda (409) dan kos lain (404) ikut tercatat ditolak", async () => {
    const input = { draftId: DRAFT_CONTOH, organizationId: ORG, userId: "usr_ratna", keputusan: "setuju" as const };
    const hasil = await putuskanDraftDariDashboard(db, input, { wa, baseUrl: "https://kostera.id", sekarang: SEKARANG });
    assert.equal(hasil.status, "dijalankan");
    await assert.rejects(
      putuskanDraftDariDashboard(db, input, { wa, baseUrl: "https://kostera.id", sekarang: SEKARANG }),
      (err) => err instanceof GalatAksi && err.status === 409,
    );
    await assert.rejects(
      putuskanDraftDariDashboard(db, { ...input, organizationId: "org_griya_asri", userId: "usr_pemilik_griya" }, { wa, baseUrl: "https://kostera.id" }),
      (err) => err instanceof GalatAksi && err.status === 404,
    );
    assert.equal(kePenyewa(), 3);
    const audit = await db
      .select({ hasil: schema.kostaAuditLogs.hasil, org: schema.kostaAuditLogs.organizationId, saluran: schema.kostaAuditLogs.saluran })
      .from(schema.kostaAuditLogs)
      .where(eq(schema.kostaAuditLogs.actionId, DRAFT_CONTOH));
    assert.deepEqual(
      audit.map((a) => `${a.saluran} ${a.org} ${a.hasil}`).sort(),
      ["dashboard org_griya_asri ditolak", "dashboard org_kos_melati dijalankan", "dashboard org_kos_melati ditolak"],
    );
  });

  describe("status bayar tidak bisa diubah lewat Kosta", () => {
    const statusInvoice = async () =>
      Object.fromEntries(
        (
          await db
            .select({ id: schema.invoices.id, status: schema.invoices.status })
            .from(schema.invoices)
            .where(and(eq(schema.invoices.organizationId, ORG), inArray(schema.invoices.id, ["inv_2026-09_A05", "inv_2026-09_B15", "inv_2026-09_C09"])))
        ).map((i) => [i.id, i.status]),
      );

    it("permintaan tandai lunas (klaim transfer, 'lunasin', 'anggap sudah bayar') ditolak & tercatat; status tidak berubah", async () => {
      const sebelum = await statusInvoice();
      const jumlahBayar = (await db.select().from(schema.payments)).length;
      for (const teks of ["A05 sudah transfer, tolong tandai lunas ya", "lunasin B15", "anggap C09 sudah bayar aja", "update status A05 jadi paid"]) {
        const { balasan, audit } = await chat(teks);
        assert.equal(balasan.teks, TOLAK_TANDAI_LUNAS, teks);
        assert.deepEqual([audit.intent, audit.hasil], ["mark_invoice_paid", "ditolak"], teks);
      }
      assert.deepEqual(await statusInvoice(), sebelum);
      assert.equal((await db.select().from(schema.payments)).length, jumlahBayar);
    });

    it("pertanyaan status bayar tetap dijawab (bukan ditolak)", async () => {
      const { balasan, audit } = await chat("A03 sudah lunas belum?");
      assert.notEqual(balasan.teks, TOLAK_TANDAI_LUNAS);
      assert.equal(audit.intent, "get_room_status");
    });

    it("tidak ada tool Kosta yang bisa mengubah status bayar", () => {
      assert.deepEqual(
        ALAT.map((a) => a.name).sort(),
        ["cek_kamar", "draft_tagihan", "ganti_kos", "kamar_kosong", "keluar_penghuni", "konfirmasi", "koreksi_draft", "lihat_tunggakan", "pindah_penghuni", "rekap_pemasukan", "siapkan_reminder"],
      );
    });
  });
});
