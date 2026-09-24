import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { eq } from "drizzle-orm";

import type { Db } from "../../db/index.ts";
import * as schema from "../../db/schema.ts";
import { isiDataContoh } from "../../db/seed.ts";
import { buatDbUji } from "../../db/testing.ts";
import { getKamarKosong, getPenghuniNonaktif } from "../data/kamar.ts";
import { terbitkanTagihanTerjadwal } from "../penjadwal/tagihan-terjadwal.ts";
import { GalatAksi } from "./galat.ts";
import { bacaInputKeluarPenghuni, keluarPenghuni } from "./penghuni.ts";

const ORG = "org_kos_melati";
const HARI_INI = "2026-09-25";

describe("keluarPenghuni", () => {
  let db: Db;
  let tutup: () => Promise<void>;
  const gagal = (input: Parameters<typeof keluarPenghuni>[2], status: number, pola?: RegExp) =>
    assert.rejects(keluarPenghuni(db, ORG, input, HARI_INI), (err) => err instanceof GalatAksi && err.status === status && (!pola || pola.test(err.message)));

  before(async () => {
    ({ db, tutup } = await buatDbUji());
    await isiDataContoh(db);
  });
  after(() => tutup());

  it("penghuni keluar, kamar kosong, riwayat ditutup; tagihan belum lunas tetap tercatat", async () => {
    const hasil = await keluarPenghuni(db, ORG, { roomId: "room_A05", tanggal: "2026-09-25", alasan: "Pindah kos lain" }, HARI_INI);
    assert.deepEqual(hasil, { nama: "Rizky Ramadhan", nomorKamar: "A05", tagihanTerbuka: { jumlah: 1, nominal: 500_000 } });

    const [rizky] = await db.select().from(schema.tenants).where(eq(schema.tenants.id, "tnt_A05"));
    assert.deepEqual([rizky.status, rizky.tanggalKeluar, rizky.alasanKeluar], ["keluar", "2026-09-25", "Pindah kos lain"]);
    const [kamar] = await db.select().from(schema.rooms).where(eq(schema.rooms.id, "room_A05"));
    assert.equal(kamar.status, "kosong");
    const [hunian] = await db.select().from(schema.riwayatHunian).where(eq(schema.riwayatHunian.tenantId, "tnt_A05"));
    assert.deepEqual([hunian.tanggalSelesai, hunian.alasanSelesai], ["2026-09-25", "keluar"]);
    const [inv] = await db.select().from(schema.invoices).where(eq(schema.invoices.id, "inv_2026-09_A05"));
    assert.equal(inv.status, "jatuh_tempo");
  });

  it("muncul di daftar nonaktif & kamar kosong", async () => {
    const [terbaru] = await getPenghuniNonaktif(db, ORG);
    assert.deepEqual([terbaru.nama, terbaru.alasanKeluar], ["Rizky Ramadhan", "Pindah kos lain"]);
    const a05 = (await getKamarKosong(db, ORG)).find((k) => k.nomorKamar === "A05");
    assert.deepEqual([a05?.penghuniTerakhir, a05?.alasanTerakhir, a05?.kosongSejak], ["Rizky Ramadhan", "keluar", "2026-09-25"]);
  });

  it("tagihan terjadwal berikutnya tidak lagi terbit untuknya", async () => {
    await db.insert(schema.invoiceSchedules).values({ organizationId: ORG, aktif: true, diperbaruiPada: new Date("2026-09-20T00:00:00+07:00") });
    await terbitkanTagihanTerjadwal(db, "2026-10-01");
    const oktober = await db.select().from(schema.invoices).where(eq(schema.invoices.periode, "2026-10"));
    assert.equal(oktober.length, 33);
    assert.ok(oktober.every((i) => i.tenantId !== "tnt_A05"));
  });

  it("kamar kosong, tanggal di masa depan, atau sebelum mulai menghuni ditolak", async () => {
    await gagal({ roomId: "room_A05", tanggal: "2026-09-25" }, 404);
    await gagal({ roomId: "room_A01", tanggal: "2026-12-01" }, 400, /masa depan/);
    await gagal({ roomId: "room_A01", tanggal: "2020-01-01" }, 400, /sebelum tanggal mulai/);
    await assert.rejects(keluarPenghuni(db, "org_kos_mawar", { roomId: "room_A01", tanggal: "2026-09-25" }, HARI_INI), (err) => err instanceof GalatAksi && err.status === 404);
  });

  it("validasi input", () => {
    assert.deepEqual(bacaInputKeluarPenghuni({ roomId: "r", tanggal: "2026-09-25", alasan: "  " }), { roomId: "r", tanggal: "2026-09-25" });
    assert.throws(() => bacaInputKeluarPenghuni({ roomId: "", tanggal: "2026-09-25" }), GalatAksi);
    assert.throws(() => bacaInputKeluarPenghuni({ roomId: "r", tanggal: "25-09-2026" }), GalatAksi);
  });
});
