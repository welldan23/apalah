import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { and, asc, eq } from "drizzle-orm";

import type { Db } from "../../db/index.ts";
import * as schema from "../../db/schema.ts";
import { isiDataContoh } from "../../db/seed.ts";
import { buatDbUji } from "../../db/testing.ts";
import { getKamarKosong } from "../data/kamar.ts";
import { GalatAksi } from "./galat.ts";
import { ubahKamar } from "./kamar.ts";
import { bacaInputPindahKamar, pindahKamar } from "./penghuni.ts";

const ORG = "org_kos_melati";

describe("pindahKamar", () => {
  let db: Db;
  let tutup: () => Promise<void>;
  const gagal = (input: Parameters<typeof pindahKamar>[2], status: number, pola?: RegExp) =>
    assert.rejects(pindahKamar(db, ORG, input), (err) => err instanceof GalatAksi && err.status === status && (!pola || pola.test(err.message)));
  const kamar = async (id: string) => (await db.select().from(schema.rooms).where(eq(schema.rooms.id, id)))[0];
  const penghuni = async (id: string) => (await db.select().from(schema.tenants).where(eq(schema.tenants.id, id)))[0];

  before(async () => {
    ({ db, tutup } = await buatDbUji());
    await isiDataContoh(db);
  });
  after(() => tutup());

  it("sewa tetap: penghuni & status kamar berpindah, riwayat ditutup dan dibuka", async () => {
    const hasil = await pindahKamar(db, ORG, { dariRoomId: "room_A01", keRoomId: "room_C03", tanggal: "2026-09-25", sewa: "tetap" });
    assert.deepEqual(hasil, { nama: "Dimas Pratama", dari: "A01", ke: "C03", hargaSewa: 500_000 });
    assert.equal((await kamar("room_A01")).status, "kosong");
    assert.equal((await kamar("room_C03")).status, "terisi");
    const dimas = await penghuni("tnt_A01");
    assert.deepEqual([dimas.roomId, dimas.hargaSewa], ["room_C03", 500_000]);

    const riwayat = await db
      .select()
      .from(schema.riwayatHunian)
      .where(eq(schema.riwayatHunian.tenantId, "tnt_A01"))
      .orderBy(asc(schema.riwayatHunian.tanggalMulai));
    assert.deepEqual(
      riwayat.map((r) => [r.roomId, r.tanggalMulai, r.tanggalSelesai, r.alasanSelesai]),
      [
        ["room_A01", "2025-02-03", "2026-09-25", "pindah ke C03"],
        ["room_C03", "2026-09-25", null, null],
      ],
    );
  });

  it("kamar asal muncul di kamar kosong dengan penghuni terakhir & tanggal pindah", async () => {
    const a01 = (await getKamarKosong(db, ORG)).find((k) => k.nomorKamar === "A01");
    assert.deepEqual([a01?.kosongSejak, a01?.penghuniTerakhir], ["2026-09-25", "Dimas Pratama"]);
  });

  it("sewa ikut kamar tujuan", async () => {
    const hasil = await pindahKamar(db, ORG, { dariRoomId: "room_C01", keRoomId: "room_A11", tanggal: "2026-10-01", sewa: "ikut_kamar" });
    assert.equal(hasil.hargaSewa, 500_000);
    assert.equal((await penghuni("tnt_C01")).hargaSewa, 500_000);
  });

  it("tagihan yang sudah terbit tidak berubah", async () => {
    const [inv] = await db
      .select()
      .from(schema.invoices)
      .where(and(eq(schema.invoices.tenantId, "tnt_C01"), eq(schema.invoices.periode, "2026-09")));
    assert.deepEqual([inv.roomId, inv.nominal], ["room_C01", 800_000]);
  });

  it("tujuan terisi/nonaktif/tidak ada, asal kosong, dan tanggal sebelum mulai ditolak", async () => {
    await gagal({ dariRoomId: "room_A02", keRoomId: "room_A03", tanggal: "2026-09-25", sewa: "tetap" }, 409, /A03 sudah terisi/);
    await ubahKamar(db, ORG, "room_B13", { aktif: false });
    await gagal({ dariRoomId: "room_A02", keRoomId: "room_B13", tanggal: "2026-09-25", sewa: "tetap" }, 409, /B13 sedang nonaktif/);
    await gagal({ dariRoomId: "room_A02", keRoomId: "room_tidak_ada", tanggal: "2026-09-25", sewa: "tetap" }, 404);
    await gagal({ dariRoomId: "room_A07", keRoomId: "room_B05", tanggal: "2026-09-25", sewa: "tetap" }, 404);
    await gagal({ dariRoomId: "room_A02", keRoomId: "room_B05", tanggal: "2020-01-01", sewa: "tetap" }, 400, /sebelum tanggal mulai/);
    // Gagal di tengah tidak meninggalkan perubahan setengah jalan.
    assert.equal((await kamar("room_B05")).status, "kosong");
    assert.equal((await penghuni("tnt_A02")).roomId, "room_A02");
  });

  it("validasi input", () => {
    const benar = { dariRoomId: "a", keRoomId: "b", tanggal: "2026-09-25", sewa: "tetap" };
    assert.deepEqual(bacaInputPindahKamar(benar), benar);
    assert.throws(() => bacaInputPindahKamar({ ...benar, keRoomId: "a" }), GalatAksi);
    assert.throws(() => bacaInputPindahKamar({ ...benar, tanggal: "2026-02-30" }), GalatAksi);
    assert.throws(() => bacaInputPindahKamar({ ...benar, sewa: "diskon" }), GalatAksi);
  });
});
