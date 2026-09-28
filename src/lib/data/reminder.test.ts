import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import type { Db } from "../../db/index.ts";
import * as schema from "../../db/schema.ts";
import { isiDataContoh } from "../../db/seed.ts";
import { buatDbUji } from "../../db/testing.ts";
import {
  bacaFilterRiwayatReminder,
  getKandidatReminder,
  getRiwayatReminder,
  getStatistikReminder,
  kursorSetelah,
} from "./reminder.ts";

const ORG = "org_kos_melati";

describe("data reminder", () => {
  let db: Db;
  let tutup: () => Promise<void>;
  const catat = (kamar: string, jenis: string, status: "terkirim" | "gagal", waktu: string, galat?: string) =>
    db.insert(schema.reminders).values({
      organizationId: ORG,
      invoiceId: `inv_2026-09_${kamar}`,
      tenantId: `tnt_${kamar}`,
      jenis,
      status,
      galat,
      terkirimPada: new Date(waktu),
    });

  before(async () => {
    ({ db, tutup } = await buatDbUji());
    await isiDataContoh(db);
    // Mulai dari riwayat kosong supaya angka di test ini pasti.
    await db.delete(schema.reminders);
    await catat("A05", "H+3", "terkirim", "2026-09-18T09:00:00+07:00");
    await catat("A05", "manual", "terkirim", "2026-09-22T19:00:00+07:00");
    await catat("B06", "manual", "gagal", "2026-09-22T18:59:00+07:00", "nomor tidak aktif");
    await catat("C05", "H-3", "terkirim", "2026-08-31T09:00:00+07:00"); // bulan kirim Agustus
    await catat("A01", "konfirmasi_lunas", "terkirim", "2026-09-02T10:00:00+07:00"); // bukan pengingat
  });
  after(() => tutup());

  it("riwayat: pengingat saja, terbaru di atas, lengkap nama & kamar", async () => {
    const riwayat = await getRiwayatReminder(db, ORG);
    assert.deepEqual(
      riwayat.map((r) => [r.nomorKamar, r.jenis, r.status]),
      [
        ["A05", "manual", "terkirim"],
        ["B06", "manual", "gagal"],
        ["A05", "H+3", "terkirim"],
        ["C05", "H-3", "terkirim"],
      ],
    );
    assert.equal(riwayat[0].namaPenghuni, "Rizky Ramadhan");
    assert.equal(riwayat[0].terkirimPada, "2026-09-22T12:00:00.000Z");
  });

  it("riwayat per bulan kirim (WIB) & batas jumlah", async () => {
    assert.deepEqual((await getRiwayatReminder(db, ORG, { periode: "2026-08" })).map((r) => r.nomorKamar), ["C05"]);
    assert.equal((await getRiwayatReminder(db, ORG, { batas: 2 })).length, 2);
  });

  it("statistik bulan kirim: terkirim, gagal, penyewa unik", async () => {
    assert.deepEqual(await getStatistikReminder(db, ORG, "2026-09"), { terkirim: 2, gagal: 1, penyewa: 1 });
    assert.deepEqual(await getStatistikReminder(db, "org_kos_mawar", "2026-09"), { terkirim: 0, gagal: 0, penyewa: 0 });
  });

  it("kandidat: tagihan belum lunas + terakhir diingatkan (yang gagal tidak dihitung)", async () => {
    const kandidat = await getKandidatReminder(db, ORG);
    assert.equal(kandidat.length, 14); // 11 menunggu + 3 jatuh tempo
    assert.ok(kandidat.every((k) => ["menunggu", "terkirim", "jatuh_tempo"].includes(k.status)));
    const peta = new Map(kandidat.map((k) => [k.nomorKamar, k.terakhirDiingatkan]));
    assert.equal(peta.get("A05"), "2026-09-22T12:00:00.000Z");
    assert.equal(peta.get("B06"), undefined);
    assert.equal(peta.get("A03"), undefined);
  });

  it("filter status, jenis, periode tagihan, dan cari (wildcard dianggap huruf biasa); alasan gagal ikut", async () => {
    const kamar = async (filter: Parameters<typeof getRiwayatReminder>[2]) =>
      (await getRiwayatReminder(db, ORG, filter)).map((r) => `${r.nomorKamar} ${r.jenis}`);
    assert.deepEqual(await kamar({ status: "gagal" }), ["B06 manual"]);
    assert.equal((await getRiwayatReminder(db, ORG, { status: "gagal" }))[0].galat, "nomor tidak aktif");
    assert.equal((await getRiwayatReminder(db, ORG, { status: "terkirim" }))[0].galat, undefined);
    assert.deepEqual(await kamar({ jenis: "H+3" }), ["A05 H+3"]);
    assert.deepEqual(await kamar({ periodeTagihan: "2026-08" }), []);
    assert.deepEqual(await kamar({ periodeTagihan: "2026-09", periode: "2026-09", status: "terkirim" }), ["A05 manual", "A05 H+3"]);
    assert.deepEqual(await kamar({ cari: "  RIZKY " }), ["A05 manual", "A05 H+3"]);
    assert.deepEqual(await kamar({ cari: "c0" }), ["C05 H-3"]);
    assert.deepEqual(await kamar({ cari: "%" }), []);
  });

  it("halaman lanjut dengan kursor tetap utuh walau waktu kirimnya sama", async () => {
    // Tiga pengingat terkirim pada detik yang sama (kiriman massal).
    for (const k of ["A03", "A06", "A08"]) await catat(k, "manual", "terkirim", "2026-09-23T09:00:00+07:00");
    const semua = await getRiwayatReminder(db, ORG);
    const halaman: string[] = [];
    let sebelum: { terkirimPada: string; id: string } | undefined;
    for (;;) {
      const baris = await getRiwayatReminder(db, ORG, { batas: 2, sebelum });
      if (baris.length === 0) break;
      halaman.push(...baris.map((r) => r.id));
      const [terkirimPada, id] = kursorSetelah(baris.at(-1)!).split("|");
      sebelum = { terkirimPada, id };
    }
    assert.deepEqual(halaman, semua.map((r) => r.id));
    assert.equal(new Set(halaman).size, 7);
  });

  it("query endpoint: bawaan bulan berjalan; nilai yang tidak dikenal ditolak", () => {
    const baca = (q: string) => bacaFilterRiwayatReminder(new URLSearchParams(q), "2026-09");
    assert.deepEqual(baca(""), {
      query: { periode: "2026-09", status: "semua", jenis: "", tagihan: "", q: "", batas: 50, sebelum: "" },
      filter: { periode: "2026-09", status: undefined, jenis: undefined, periodeTagihan: undefined, cari: undefined, sebelum: undefined, batas: 50 },
    });
    const penuh = baca("periode=semua&status=gagal&jenis=H-3&tagihan=2026-08&q=rizky&batas=10&sebelum=2026-09-22T12:00:00.000Z|abc");
    assert.ok("filter" in penuh);
    assert.deepEqual(penuh.filter, {
      periode: undefined,
      status: "gagal",
      jenis: "H-3",
      periodeTagihan: "2026-08",
      cari: "rizky",
      sebelum: { terkirimPada: "2026-09-22T12:00:00.000Z", id: "abc" },
      batas: 10,
    });
    for (const [q, pesan] of [
      ["periode=9-2026", /Periode harus/],
      ["status=lunas", /Status tidak dikenal/],
      ["tagihan=agustus", /Periode tagihan/],
      ["batas=0", /Batas harus 1–200/],
      ["batas=201", /Batas harus/],
      ["sebelum=kemarin", /Kursor/],
      [`q=${"x".repeat(101)}`, /maksimal 100/],
    ] as const) {
      const hasil = baca(q);
      assert.ok("galat" in hasil && pesan.test(hasil.galat), q);
    }
  });
});
