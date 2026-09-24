import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import type { Db } from "../../db/index.ts";
import { isiDataContoh } from "../../db/seed.ts";
import { buatDbUji } from "../../db/testing.ts";
import { GalatAksi } from "./galat.ts";
import { susunPesanReminder } from "./pesan-reminder.ts";

const ORG = "org_kos_melati";
const BASE = "https://kostera.id";

describe("service penyusun pesan reminder", () => {
  let db: Db;
  let tutup: () => Promise<void>;
  const susun = (ids: string[], hariIni: string, org = ORG) => susunPesanReminder(db, org, ids, { baseUrl: BASE, hariIni });

  before(async () => {
    ({ db, tutup } = await buatDbUji());
    await isiDataContoh(db);
  });
  after(() => tutup());

  it("template mengikuti waktu: sebelum, di hari, dan setelah jatuh tempo", async () => {
    // A03 jatuh tempo 26 Sep, A05 jatuh tempo 15 Sep.
    const [h3] = await susun(["inv_2026-09_A03"], "2026-09-23");
    assert.equal(
      h3.teks,
      "Halo Yoga, pengingat dari Kos Melati: tagihan sewa kamar A03 periode September 2026 sebesar Rp500.000 jatuh tempo 26 Sep 2026 (3 hari lagi). Silakan bayar lewat link invoice berikut. Terima kasih.\nhttps://kostera.id/invoice/demo-a03-2026-09",
    );
    const [h] = await susun(["inv_2026-09_A03"], "2026-09-26");
    assert.match(h.teks, /jatuh tempo hari ini\. /);
    const [lewat] = await susun(["inv_2026-09_A05"], "2026-09-18");
    assert.match(lewat.teks, /^Halo Rizky, ini pengingat dari Kos Melati\. .* sudah lewat jatuh tempo \(15 Sep 2026\)\./);
    // Versi template resmi untuk WhatsApp Cloud API: tombol ke invoice yang sama.
    assert.deepEqual([h3.template.nama, lewat.template.nama], ["kostera_pengingat_sebelum", "kostera_pengingat_lewat"]);
    assert.equal(lewat.template.tombolUrl, "demo-a05-2026-09");
  });

  it("data penerima dari database, urut nomor kamar", async () => {
    const pesan = await susun(["inv_2026-09_C05", "inv_2026-09_A05", "inv_2026-09_B06"], "2026-09-24");
    assert.deepEqual(
      pesan.map(({ invoiceId, tenantId, nomorKamar, namaPenghuni }) => [invoiceId, tenantId, nomorKamar, namaPenghuni]),
      [
        ["inv_2026-09_A05", "tnt_A05", "A05", "Rizky Ramadhan"],
        ["inv_2026-09_B06", "tnt_B06", "B06", "Reza Kurniawan"],
        ["inv_2026-09_C05", "tnt_C05", "C05", "Nadia Safitri"],
      ],
    );
    assert.ok(pesan.every((p) => /^628\d+$/.test(p.nomorWa) && p.teks.endsWith(`/invoice/demo-${p.nomorKamar.toLowerCase()}-2026-09`)));
    assert.deepEqual(await susun([], "2026-09-24"), []);
  });

  it("tagihan lunas / perlu review ditolak (409); tagihan kos lain tidak ditemukan (404)", async () => {
    const galat = (status: number, pesan?: RegExp) => (err: unknown) =>
      err instanceof GalatAksi && err.status === status && (!pesan || pesan.test(err.message));
    await assert.rejects(susun(["inv_2026-09_A05", "inv_2026-09_A01", "inv_2026-09_C09"], "2026-09-24"), galat(409, /kamar A01, C09\)/));
    await assert.rejects(susun(["inv_2026-09_A05", "inv_tidak_ada"], "2026-09-24"), galat(404));
    await assert.rejects(susun(["inv_2026-09_A05"], "2026-09-24", "org_kos_mawar"), galat(404));
  });
});
