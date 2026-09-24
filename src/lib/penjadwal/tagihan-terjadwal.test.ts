import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { and, eq } from "drizzle-orm";

import type { Db } from "../../db/index.ts";
import * as schema from "../../db/schema.ts";
import { isiDataContoh } from "../../db/seed.ts";
import { buatDbUji } from "../../db/testing.ts";
import { cronDiizinkan } from "./otorisasi.ts";
import { terbitkanTagihanTerjadwal } from "./tagihan-terjadwal.ts";

const ORG = "org_kos_melati";

describe("terbitkanTagihanTerjadwal", () => {
  let db: Db;
  let tutup: () => Promise<void>;

  /** Timpa jadwal Kos Melati, seolah disimpan owner pada `disimpan` (WIB). */
  const aturJadwal = async (
    nilai: Partial<typeof schema.invoiceSchedules.$inferInsert>,
    disimpan: string,
  ) => {
    const baris = {
      aktif: true,
      tanggalTerbit: 1,
      aturanJatuhTempo: "tanggal_masuk" as const,
      tanggalJatuhTempo: null,
      ...nilai,
      diperbaruiPada: new Date(`${disimpan}T09:00:00+07:00`),
    };
    await db
      .insert(schema.invoiceSchedules)
      .values({ organizationId: ORG, ...baris })
      .onConflictDoUpdate({ target: schema.invoiceSchedules.organizationId, set: baris });
  };

  const tagihanPeriode = (periode: string) =>
    db
      .select()
      .from(schema.invoices)
      .where(and(eq(schema.invoices.organizationId, ORG), eq(schema.invoices.periode, periode)));

  before(async () => {
    ({ db, tutup } = await buatDbUji());
    await isiDataContoh(db);
    // Penghuni yang baru masuk bulan November — belum ditagih untuk Oktober.
    await db.insert(schema.tenants).values({
      id: "tnt_baru_A07",
      organizationId: ORG,
      nama: "Penghuni November",
      nomorWa: "6281300000007",
      roomId: "room_A07",
      tanggalMasuk: "2026-11-02",
      hargaSewa: 500_000,
    });
    // Kos lain dengan jadwal aktif tapi tanpa penghuni.
    await db.insert(schema.users).values({ id: "usr_lain", nama: "Owner Lain", nomorWa: "6280000000001" });
    await db.insert(schema.organizations).values({ id: "org_lain", namaKos: "Kos Lain", jumlahKamar: 1, ownerId: "usr_lain" });
    await db.insert(schema.invoiceSchedules).values({
      organizationId: "org_lain",
      aktif: true,
      diperbaruiPada: new Date("2026-09-01T09:00:00+07:00"),
    });
  });
  after(() => tutup());

  it("tanpa jadwal aktif di Kos Melati, hanya kos lain yang diproses", async () => {
    assert.deepEqual(await terbitkanTagihanTerjadwal(db, "2026-10-01"), [
      { organizationId: "org_lain", periode: "2026-10", dibuat: 0, totalNominal: 0 },
    ]);
    assert.equal((await tagihanPeriode("2026-10")).length, 0);
  });

  it("jadwal nonaktif dilewati", async () => {
    await aturJadwal({ aktif: false }, "2026-09-20");
    const hasil = await terbitkanTagihanTerjadwal(db, "2026-10-01");
    assert.ok(hasil.every((h) => h.organizationId !== ORG));
  });

  it("di tanggal terbit: tagihan semua penghuni aktif, jatuh tempo ikut tanggal masuk, lengkap rincian", async () => {
    await aturJadwal({}, "2026-09-20");
    const [melati] = (await terbitkanTagihanTerjadwal(db, "2026-10-01")).filter((h) => h.organizationId === ORG);
    assert.deepEqual(melati, { organizationId: ORG, periode: "2026-10", dibuat: 34, totalNominal: 22_100_000 });

    const oktober = await tagihanPeriode("2026-10");
    const a05 = oktober.find((inv) => inv.roomId === "room_A05")!; // masuk 15 Nov 2024
    assert.equal(a05.jatuhTempo, "2026-10-15");
    assert.equal(a05.status, "menunggu");
    assert.ok(oktober.every((inv) => inv.tenantId !== "tnt_baru_A07"));
    const rincian = await db.select().from(schema.invoiceItems).where(eq(schema.invoiceItems.invoiceId, a05.id));
    assert.deepEqual(rincian.map((r) => [r.label, r.nominal]), [["Sewa kamar", 500_000]]);
  });

  it("aman dijalankan ulang (tidak ada tagihan ganda)", async () => {
    const [melati] = (await terbitkanTagihanTerjadwal(db, "2026-10-02")).filter((h) => h.organizationId === ORG);
    assert.equal(melati.dibuat, 0);
    assert.equal((await tagihanPeriode("2026-10")).length, 34);
  });

  it("belum tanggal terbit → belum diterbitkan", async () => {
    await aturJadwal({ tanggalTerbit: 5 }, "2026-10-20");
    const hasil = await terbitkanTagihanTerjadwal(db, "2026-11-04");
    assert.ok(hasil.every((h) => h.organizationId !== ORG));
  });

  it("jatuh tempo tanggal tetap; penghuni yang masuk di periode itu ikut ditagih", async () => {
    await aturJadwal({ tanggalTerbit: 5, aturanJatuhTempo: "tanggal_tetap", tanggalJatuhTempo: 10 }, "2026-10-20");
    // Cron sempat mati tanggal 5–6: disusul tanggal 7.
    const [melati] = (await terbitkanTagihanTerjadwal(db, "2026-11-07")).filter((h) => h.organizationId === ORG);
    assert.equal(melati.dibuat, 35);
    const november = await tagihanPeriode("2026-11");
    assert.ok(november.every((inv) => inv.jatuhTempo === "2026-11-10"));
    assert.ok(november.some((inv) => inv.tenantId === "tnt_baru_A07"));
  });

  it("jadwal yang diaktifkan setelah tanggal terbit baru berlaku bulan depan", async () => {
    await aturJadwal({ tanggalTerbit: 1 }, "2026-12-03");
    const hasil = await terbitkanTagihanTerjadwal(db, "2026-12-03");
    assert.ok(hasil.every((h) => h.organizationId !== ORG));
    assert.equal((await tagihanPeriode("2026-12")).length, 0);

    const [januari] = (await terbitkanTagihanTerjadwal(db, "2027-01-01")).filter((h) => h.organizationId === ORG);
    assert.equal(januari.dibuat, 35);
  });
});

describe("cronDiizinkan", () => {
  it("hanya header Bearer yang cocok dengan CRON_SECRET", () => {
    assert.equal(cronDiizinkan("Bearer rahasia-panjang", "rahasia-panjang"), true);
    assert.equal(cronDiizinkan("Bearer salah", "rahasia-panjang"), false);
    assert.equal(cronDiizinkan("rahasia-panjang", "rahasia-panjang"), false);
    assert.equal(cronDiizinkan(null, "rahasia-panjang"), false);
    // Tanpa CRON_SECRET, semua ditolak.
    assert.equal(cronDiizinkan("Bearer ", ""), false);
  });
});
