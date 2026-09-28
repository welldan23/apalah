import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { eq } from "drizzle-orm";

import type { Db } from "../../db/index.ts";
import * as schema from "../../db/schema.ts";
import { isiDataContoh } from "../../db/seed.ts";
import { buatDbUji } from "../../db/testing.ts";
import { GALAT_TERPUTUS } from "../reminder.ts";
import type { PengirimWhatsApp, PesanWhatsApp } from "../whatsapp/index.ts";
import { kirimReminder } from "./reminder.ts";

const ORG = "org_kos_melati";
const SEKARANG = new Date("2026-09-24T10:00:00+07:00");
const IDS = ["inv_2026-09_A05", "inv_2026-09_B06", "inv_2026-09_C05"];

function buatWa({ gagalUntuk = [] as string[], jeda = 0 } = {}) {
  const terkirim: PesanWhatsApp[] = [];
  const wa: PengirimWhatsApp = {
    provider: "uji",
    simulasi: false,
    async kirim(pesan) {
      if (jeda) await new Promise((r) => setTimeout(r, jeda));
      terkirim.push(pesan);
      return gagalUntuk.some((k) => pesan.teks.includes(`kamar ${k}`)) ? { ok: false, galat: "nomor tidak aktif" } : { ok: true };
    },
  };
  return { wa, terkirim };
}

describe("konfirmasi kirim reminder massal", () => {
  let db: Db;
  let tutup: () => Promise<void>;
  const opsi = (sekarang = SEKARANG) => ({ baseUrl: "https://kostera.id", hariIni: "2026-09-24", sekarang });
  const logManual = async () =>
    (await db.select().from(schema.reminders).where(eq(schema.reminders.jenis, "manual")))
      .map((r) => `${r.invoiceId.slice(-3)} ${r.status} ${r.galat}`)
      .sort();

  beforeEach(async () => {
    ({ db, tutup } = await buatDbUji());
    await isiDataContoh(db);
  });
  afterEach(() => tutup());

  it("penyewa yang dihubungi < 24 jam lalu dilewati, tidak dikirimi, dan tidak dicatat", async () => {
    await db.insert(schema.reminders).values({
      organizationId: ORG,
      invoiceId: "inv_2026-09_B06",
      tenantId: "tnt_B06",
      jenis: "tagihan",
      status: "terkirim",
      terkirimPada: new Date(SEKARANG.getTime() - 3 * 3_600_000),
    });
    const { wa, terkirim } = buatWa();
    assert.deepEqual(await kirimReminder(db, ORG, { invoiceIds: IDS }, wa, opsi()), {
      terkirim: 2,
      gagal: [],
      ditahan: [],
      dilewati: ["B06"],
      simulasi: false,
    });
    assert.equal(terkirim.length, 2);
    assert.deepEqual(await logManual(), ["A05 terkirim null", "C05 terkirim null"]);
  });

  it("konfirmasi ganda — berurutan maupun bersamaan — tiap penyewa hanya dikirimi sekali", async () => {
    const { wa, terkirim } = buatWa({ jeda: 5 });
    const [a, b] = await Promise.all([
      kirimReminder(db, ORG, { invoiceIds: IDS }, wa, opsi()),
      kirimReminder(db, ORG, { invoiceIds: IDS }, wa, opsi()),
    ]);
    assert.equal(a.terkirim + b.terkirim, 3);
    assert.deepEqual([...a.dilewati, ...b.dilewati].sort(), ["A05", "B06", "C05"]);
    const ketiga = await kirimReminder(db, ORG, { invoiceIds: IDS }, wa, opsi(new Date(SEKARANG.getTime() + 60_000)));
    assert.deepEqual(ketiga.dilewati, ["A05", "B06", "C05"]);
    assert.equal(terkirim.length, 3);
    assert.equal((await logManual()).length, 3);
  });

  it("kiriman gagal boleh langsung dikirim ulang; klaim yang terputus tetap dihitung sudah dihubungi", async () => {
    const pertama = buatWa({ gagalUntuk: ["C05"] });
    assert.deepEqual((await kirimReminder(db, ORG, { invoiceIds: IDS }, pertama.wa, opsi())).gagal, ["C05"]);
    const ulang = buatWa();
    const hasil = await kirimReminder(db, ORG, { invoiceIds: ["inv_2026-09_C05"] }, ulang.wa, opsi(new Date(SEKARANG.getTime() + 60_000)));
    assert.deepEqual([hasil.terkirim, hasil.dilewati], [1, []]);
    assert.deepEqual(await logManual(), ["A05 terkirim null", "B06 terkirim null", "C05 gagal nomor tidak aktif", "C05 terkirim null"]);

    // Proses sebelumnya terputus di tengah jalan untuk A03: klaimnya masih tercatat.
    await db.insert(schema.reminders).values({
      organizationId: ORG,
      invoiceId: "inv_2026-09_A03",
      tenantId: "tnt_A03",
      jenis: "manual",
      status: "gagal",
      galat: GALAT_TERPUTUS,
      terkirimPada: SEKARANG,
    });
    const lagi = buatWa();
    assert.deepEqual((await kirimReminder(db, ORG, { invoiceIds: ["inv_2026-09_A03"] }, lagi.wa, opsi())).dilewati, ["A03"]);
    assert.equal(lagi.terkirim.length, 0);
  });
});
