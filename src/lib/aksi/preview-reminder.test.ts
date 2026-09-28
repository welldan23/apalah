import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import type { Db } from "../../db/index.ts";
import * as schema from "../../db/schema.ts";
import { isiDataContoh } from "../../db/seed.ts";
import { buatDbUji } from "../../db/testing.ts";
import { GalatAksi } from "./galat.ts";
import { previewReminder } from "./preview-reminder.ts";

const ORG = "org_kos_melati";
const SEKARANG = new Date("2026-09-24T10:00:00+07:00");
const IDS = ["inv_2026-09_A05", "inv_2026-09_B06", "inv_2026-09_C05", "inv_2026-09_A03"];

describe("preview reminder massal", () => {
  let db: Db;
  let tutup: () => Promise<void>;
  const preview = (ids = IDS) => previewReminder(db, ORG, ids, { baseUrl: "https://kostera.id", hariIni: "2026-09-24", sekarang: SEKARANG });
  const kontak = (kamar: string, jamLalu: number, jenis = "manual", status: "terkirim" | "gagal" = "terkirim") =>
    db.insert(schema.reminders).values({
      organizationId: ORG,
      invoiceId: `inv_2026-09_${kamar}`,
      tenantId: `tnt_${kamar}`,
      jenis,
      status,
      terkirimPada: new Date(SEKARANG.getTime() - jamLalu * 3_600_000),
    });

  before(async () => {
    ({ db, tutup } = await buatDbUji());
    await isiDataContoh(db);
  });
  after(() => tutup());

  it("penerima urut kamar dengan isi pesan persis, total, dan periode", async () => {
    const hasil = await preview();
    assert.deepEqual(
      hasil.penerima.map((p) => [p.nomorKamar, p.nominal, p.jatuhTempo]),
      [
        ["A03", 500_000, "2026-09-26"],
        ["A05", 500_000, "2026-09-15"],
        ["B06", 650_000, "2026-09-18"],
        ["C05", 800_000, "2026-09-20"],
      ],
    );
    assert.deepEqual([hasil.total, hasil.periode, hasil.dilewati], [2_450_000, ["2026-09"], []]);
    assert.match(hasil.penerima[0].pesan, /^Halo Yoga, pengingat dari Kos Melati: .*\(2 hari lagi\)[\s\S]*\nhttps:\/\/kostera\.id\/invoice\/demo-a03-2026-09$/);
    assert.match(hasil.penerima[1].pesan, /sudah lewat jatuh tempo \(15 Sep 2026\)/);
  });

  it("penyewa yang dihubungi < 24 jam lalu dilewati; konfirmasi lunas & kiriman gagal tidak dihitung", async () => {
    await kontak("B06", 3);
    await kontak("A05", 2, "konfirmasi_lunas");
    await kontak("C05", 1, "manual", "gagal");
    await kontak("A03", 25, "tagihan");
    const hasil = await preview();
    assert.deepEqual(hasil.penerima.map((p) => p.nomorKamar), ["A03", "A05", "C05"]);
    assert.deepEqual(
      hasil.dilewati.map((d) => [d.nomorKamar, d.terakhirDihubungi]),
      [["B06", new Date(SEKARANG.getTime() - 3 * 3_600_000).toISOString()]],
    );
    assert.equal(hasil.total, 1_800_000);
  });

  it("tagihan yang tidak boleh diingatkan atau milik kos lain ditolak; tidak ada yang dikirim", async () => {
    await assert.rejects(preview(["inv_2026-09_A01"]), (err) => err instanceof GalatAksi && err.status === 409);
    await assert.rejects(preview(["inv_lain"]), (err) => err instanceof GalatAksi && err.status === 404);
  });
});
