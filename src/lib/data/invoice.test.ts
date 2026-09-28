import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import type { Db } from "../../db/index.ts";
import * as schema from "../../db/schema.ts";
import { isiDataContoh } from "../../db/seed.ts";
import { buatDbUji } from "../../db/testing.ts";
import { bacaFilterDaftarInvoice, getDaftarInvoice, isInvoiceStatus } from "./invoice.ts";

const ORG = "org_kos_melati";
const SEP = "2026-09";

describe("getDaftarInvoice", () => {
  let db: Db;
  let tutup: () => Promise<void>;

  before(async () => {
    ({ db, tutup } = await buatDbUji());
    await isiDataContoh(db);
    // Invoice kos lain di periode yang sama — tidak boleh ikut tampil.
    await db.insert(schema.users).values({ id: "usr_lain", nama: "Owner Lain", nomorWa: "6280000000001" });
    await db.insert(schema.organizations).values({
      id: "org_lain",
      namaKos: "Kos Lain",
      jumlahKamar: 1,
      ownerId: "usr_lain",
    });
    await db.insert(schema.rooms).values({
      id: "room_lain",
      organizationId: "org_lain",
      nomorKamar: "A01",
      tipe: "Standar",
      hargaSewa: 400_000,
      status: "terisi",
    });
    await db.insert(schema.tenants).values({
      id: "tnt_lain",
      organizationId: "org_lain",
      nama: "Penghuni Kos Lain",
      nomorWa: "6280000000002",
      roomId: "room_lain",
      tanggalMasuk: "2026-01-05",
      hargaSewa: 400_000,
    });
    await db.insert(schema.invoices).values({
      organizationId: "org_lain",
      tenantId: "tnt_lain",
      roomId: "room_lain",
      periode: SEP,
      nominal: 400_000,
      jatuhTempo: "2026-09-05",
      status: "jatuh_tempo",
      tokenPublik: "lain-a01-2026-09",
    });
  });
  after(() => tutup());

  it("semua invoice periode ini, yang perlu ditindak paling atas", async () => {
    const daftar = await getDaftarInvoice(db, ORG, { periode: SEP });
    assert.equal(daftar.length, 34);
    assert.deepEqual(
      daftar.slice(0, 3).map((inv) => [inv.nomorKamar, inv.status, inv.jatuhTempo]),
      [
        ["A05", "jatuh_tempo", "2026-09-15"],
        ["B06", "jatuh_tempo", "2026-09-18"],
        ["C05", "jatuh_tempo", "2026-09-20"],
      ],
    );
    // Lunas di akhir, yang terbaru dibayar lebih dulu.
    const lunas = daftar.filter((inv) => inv.status === "lunas");
    assert.equal(daftar.at(-lunas.length)?.status, "lunas");
    assert.equal(lunas[0].nomorKamar, "B12");
    assert.equal(lunas[0].dibayarPada, "2026-09-20");
  });

  it("filter status", async () => {
    const hitung = async (status: Parameters<typeof getDaftarInvoice>[2]["status"]) =>
      (await getDaftarInvoice(db, ORG, { periode: SEP, status })).length;
    assert.equal(await hitung("jatuh_tempo"), 3);
    assert.equal(await hitung("menunggu"), 11);
    assert.equal(await hitung("lunas"), 19);
    assert.equal(await hitung("perlu_review"), 1);
  });

  it("baris membawa nama penghuni, nomor kamar, dan tanggal WIB", async () => {
    const [a01] = (await getDaftarInvoice(db, ORG, { periode: SEP, status: "lunas" })).filter(
      (inv) => inv.nomorKamar === "A01",
    );
    assert.equal(a01.namaPenghuni, "Dimas Pratama");
    assert.equal(a01.nominal, 500_000);
    assert.equal(a01.diterbitkanPada, "2026-08-27");
    assert.equal(a01.dibayarPada, "2026-09-02");

    const [a05] = await getDaftarInvoice(db, ORG, { periode: SEP, status: "jatuh_tempo" });
    assert.equal(a05.dibayarPada, undefined);
  });

  it("hanya invoice milik organisasinya dan periode yang diminta", async () => {
    const melati = await getDaftarInvoice(db, ORG, { periode: SEP });
    assert.ok(melati.every((inv) => inv.organizationId === ORG));
    const lain = await getDaftarInvoice(db, "org_lain", { periode: SEP });
    assert.deepEqual(lain.map((inv) => inv.namaPenghuni), ["Penghuni Kos Lain"]);
    assert.equal((await getDaftarInvoice(db, ORG, { periode: "2026-10" })).length, 0);
  });

  it("cari nama penghuni atau nomor kamar, tidak peka huruf besar/kecil", async () => {
    const cari = async (kata: string, periode: string | undefined = SEP) =>
      (await getDaftarInvoice(db, ORG, { periode, cari: kata })).map((inv) => inv.nomorKamar).sort();
    assert.deepEqual(await cari("rizky"), ["A05"]);
    assert.deepEqual(await cari("  RAMADHAN "), ["A05", "B16"]); // Rizky Ramadhan, Tiara Ramadhani
    assert.deepEqual(await cari("a0"), ["A01", "A02", "A03", "A04", "A05", "A06", "A08", "A09"]);
    // Semua periode.
    assert.deepEqual(await cari("Rizky", undefined), ["A05"]);
    // Kata kunci kosong = tanpa saringan.
    assert.equal((await cari("   ")).length, 34);
  });

  it("wildcard LIKE di kata kunci dianggap huruf biasa", async () => {
    const hitung = async (kata: string) => (await getDaftarInvoice(db, ORG, { periode: SEP, cari: kata })).length;
    assert.equal(await hitung("%"), 0);
    assert.equal(await hitung("_"), 0);
    assert.equal(await hitung("\\"), 0);
  });

  it("cari tidak menembus kos lain", async () => {
    assert.deepEqual(await getDaftarInvoice(db, ORG, { periode: SEP, cari: "Kos Lain" }), []);
  });

  it("isInvoiceStatus hanya menerima status yang dikenal", () => {
    assert.equal(isInvoiceStatus("lunas"), true);
    assert.equal(isInvoiceStatus("perlu_review"), true);
    assert.equal(isInvoiceStatus("semua"), false);
    assert.equal(isInvoiceStatus("LUNAS"), false);
  });
});

describe("bacaFilterDaftarInvoice", () => {
  const baca = (query: string) => bacaFilterDaftarInvoice(new URLSearchParams(query), SEP);

  it("bawaan: periode berjalan, semua status, urut prioritas", () => {
    assert.deepEqual(baca(""), { filter: { periode: SEP, status: "semua", q: "", urut: "prioritas" } });
  });

  it("membaca semua parameter", () => {
    assert.deepEqual(baca("periode=semua&status=lunas&q=%20dimas%20&urut=nominal"), {
      filter: { periode: "semua", status: "lunas", q: "dimas", urut: "nominal" },
    });
  });

  it("menolak nilai yang tidak dikenal", () => {
    for (const query of ["periode=2026-13", "status=bayar", "urut=acak", `q=${"x".repeat(101)}`]) {
      assert.ok("galat" in baca(query), query);
    }
  });
});
