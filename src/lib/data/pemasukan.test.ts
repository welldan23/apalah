import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import type { Db } from "../../db/index.ts";
import * as schema from "../../db/schema.ts";
import { isiDataContoh } from "../../db/seed.ts";
import { buatDbUji } from "../../db/testing.ts";
import { getRekapPemasukan } from "./pemasukan.ts";

const ORG = "org_kos_melati";
const SEP = { periode: "2026-09" };

describe("getRekapPemasukan", () => {
  let db: Db;
  let tutup: () => Promise<void>;

  before(async () => {
    ({ db, tutup } = await buatDbUji());
    await isiDataContoh(db);

    // Pembayaran nominal tidak cocok untuk invoice jatuh tempo A05 — tidak boleh dihitung.
    await db.insert(schema.payments).values({
      invoiceId: "inv_2026-09_A05",
      nominalDibayar: 450_000,
      metode: "QRIS",
      provider: "xendit",
      referensiProvider: "uji-tidak-cocok",
      status: "tidak_cocok",
      diverifikasiPada: new Date("2026-09-23T10:00:00+07:00"),
    });

    // Kos lain dengan pembayaran valid yang lebih baru — tidak boleh ikut.
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
      id: "inv_lain",
      organizationId: "org_lain",
      tenantId: "tnt_lain",
      roomId: "room_lain",
      periode: "2026-09",
      nominal: 400_000,
      jatuhTempo: "2026-09-05",
      status: "lunas",
      tokenPublik: "lain-2026-09",
    });
    await db.insert(schema.payments).values({
      invoiceId: "inv_lain",
      nominalDibayar: 400_000,
      metode: "QRIS",
      provider: "xendit",
      referensiProvider: "uji-kos-lain",
      status: "valid",
      diverifikasiPada: new Date("2026-09-24T09:00:00+07:00"),
    });
  });
  after(() => tutup());

  it("uang masuk = pembayaran valid periode ini (Rp12,5jt dari 19 pembayaran)", async () => {
    const { pemasukan } = await getRekapPemasukan(db, ORG, SEP);
    assert.equal(pemasukan.bulanIni, 12_500_000);
    assert.equal(pemasukan.jumlahPembayaran, 19);
  });

  it("tiga pembayaran terakhir, paling baru di atas", async () => {
    const { pemasukan } = await getRekapPemasukan(db, ORG, SEP);
    assert.deepEqual(
      pemasukan.terakhir.map((p) => [p.nomorKamar, p.namaPenghuni]),
      [
        ["B12", "Kevin Wijaya"],
        ["B11", "Rina Marlina"],
        ["B10", "Arif Hidayat"],
      ],
    );
    // ISO UTC; 20 Sep 08.41 WIB = 20 Sep 01.41 UTC.
    assert.equal(pemasukan.terakhir[0].diverifikasiPada, "2026-09-20T01:41:00.000Z");
  });

  it("rekap tagihan per status", async () => {
    const { tagihan } = await getRekapPemasukan(db, ORG, SEP);
    assert.deepEqual(tagihan, {
      total: { jumlah: 34, nominal: 22_100_000 },
      lunas: { jumlah: 19, nominal: 12_500_000 },
      menunggu: { jumlah: 11, nominal: 6_850_000 },
      jatuhTempo: { jumlah: 3, nominal: 1_950_000 },
      perluReview: { jumlah: 1, nominal: 800_000 },
    });
  });

  it("periode tanpa data → nol", async () => {
    const rekap = await getRekapPemasukan(db, ORG, { periode: "2026-10" });
    assert.equal(rekap.pemasukan.bulanIni, 0);
    assert.equal(rekap.pemasukan.jumlahPembayaran, 0);
    assert.deepEqual(rekap.pemasukan.terakhir, []);
    assert.deepEqual(rekap.tagihan.total, { jumlah: 0, nominal: 0 });
  });

  it("kos lain hanya melihat pembayarannya sendiri", async () => {
    const { pemasukan } = await getRekapPemasukan(db, "org_lain", SEP);
    assert.equal(pemasukan.bulanIni, 400_000);
    assert.deepEqual(pemasukan.terakhir.map((p) => p.namaPenghuni), ["Penghuni Kos Lain"]);
  });
});
