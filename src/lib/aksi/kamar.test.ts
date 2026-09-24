import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { and, eq } from "drizzle-orm";

import type { Db } from "../../db/index.ts";
import * as schema from "../../db/schema.ts";
import { isiDataContoh } from "../../db/seed.ts";
import { buatDbUji } from "../../db/testing.ts";
import { getKamarKosong, getKamarNonaktif } from "../data/kamar.ts";
import { getRingkasanKos } from "../data/kos.ts";
import { GalatAksi } from "./galat.ts";
import { bacaInputTambahKamar, bacaPerubahanKamar, tambahKamar, ubahKamar } from "./kamar.ts";
import { tambahPenghuni } from "./penghuni.ts";

const ORG = "org_kos_melati";
const PEMILIK = { organizationId: ORG, userId: "usr_ratna" };

describe("kelola kamar", () => {
  let db: Db;
  let tutup: () => Promise<void>;
  const jumlahKamar = async (org: string) =>
    (await db.select().from(schema.organizations).where(eq(schema.organizations.id, org)))[0].jumlahKamar;

  before(async () => {
    ({ db, tutup } = await buatDbUji());
    await isiDataContoh(db);
  });
  after(() => tutup());

  it("tambah kamar ke kos ini: nomor melanjutkan yang ada, status kosong, jumlah kamar ikut", async () => {
    const hasil = await tambahKamar(db, PEMILIK, {
      rencana: [
        { tipe: "Standar", kode: "A", jumlah: 2, hargaSewa: 500_000 },
        { tipe: "Suite", kode: "D", jumlah: 1, hargaSewa: 1_200_000 },
      ],
    });
    assert.deepEqual(hasil, { organizationId: ORG, namaKos: "Kos Melati", nomorKamar: ["A13", "A14", "D01"] });
    assert.equal(await jumlahKamar(ORG), 43);
    assert.equal((await getRingkasanKos(db, ORG))?.kamar.kosong, 9);
  });

  it("tambah kamar ke kos baru: kos + owner dibuat sekaligus", async () => {
    const hasil = await tambahKamar(db, PEMILIK, {
      rencana: [{ tipe: "Standar", kode: "K", jumlah: 3, hargaSewa: 450_000 }],
      kosBaru: { namaKos: "Kos Kenanga", alamat: "Jl. Kenanga 1" },
    });
    assert.equal(hasil.namaKos, "Kos Kenanga");
    assert.deepEqual(hasil.nomorKamar, ["K01", "K02", "K03"]);
    const [owner] = await db
      .select()
      .from(schema.members)
      .where(and(eq(schema.members.organizationId, hasil.organizationId), eq(schema.members.userId, "usr_ratna")));
    assert.equal(owner.peran, "owner");
    assert.equal(await jumlahKamar(hasil.organizationId), 3);
  });

  it("nonaktifkan kamar kosong: hilang dari hitungan & daftar kosong, tidak bisa diisi; aktifkan lagi", async () => {
    const nonaktif = await ubahKamar(db, ORG, "room_A07", { aktif: false, catatan: "Renovasi kamar mandi" });
    assert.deepEqual([nonaktif.aktif, nonaktif.catatan], [false, "Renovasi kamar mandi"]);
    assert.equal(await jumlahKamar(ORG), 42);
    assert.ok((await getKamarKosong(db, ORG)).every((k) => k.nomorKamar !== "A07"));
    assert.deepEqual((await getKamarNonaktif(db, ORG)).map((k) => k.nomorKamar), ["A07"]);
    await assert.rejects(
      tambahPenghuni(db, ORG, { nama: "X", nomorWa: "6281300000055", roomId: "room_A07", tanggalMasuk: "2026-09-24", hargaSewa: 500_000 }),
      (err) => err instanceof GalatAksi && /A07 sedang nonaktif/.test(err.message),
    );

    await ubahKamar(db, ORG, "room_A07", { aktif: true });
    assert.equal(await jumlahKamar(ORG), 43);
    assert.deepEqual(await getKamarNonaktif(db, ORG), []);
  });

  it("kamar terisi tidak bisa dinonaktifkan; kamar kos lain tidak ditemukan", async () => {
    await assert.rejects(ubahKamar(db, ORG, "room_A01", { aktif: false }), (err) => err instanceof GalatAksi && err.status === 409);
    await assert.rejects(ubahKamar(db, "org_kos_mawar", "room_A01", { hargaSewa: 1 }), (err) => err instanceof GalatAksi && err.status === 404);
  });

  it("ubah tipe & harga kamar tanpa mengubah sewa penghuni", async () => {
    const hasil = await ubahKamar(db, ORG, "room_A01", { tipe: "Standar Plus", hargaSewa: 550_000 });
    assert.deepEqual([hasil.tipe, hasil.hargaSewa], ["Standar Plus", 550_000]);
    const [dimas] = await db.select().from(schema.tenants).where(eq(schema.tenants.id, "tnt_A01"));
    assert.equal(dimas.hargaSewa, 500_000);
  });

  it("validasi input", () => {
    const baris = { tipe: "Standar", kode: "A", jumlah: 2, hargaSewa: 500_000 };
    assert.deepEqual(bacaInputTambahKamar({ rencana: [baris] }), { rencana: [baris] });
    assert.throws(() => bacaInputTambahKamar({ rencana: [] }), GalatAksi);
    assert.throws(() => bacaInputTambahKamar({ rencana: [{ ...baris, kode: "A1" }] }), GalatAksi);
    assert.throws(() => bacaInputTambahKamar({ rencana: [{ ...baris, jumlah: 0 }] }), GalatAksi);
    assert.throws(() => bacaInputTambahKamar({ rencana: [baris], kosBaru: { namaKos: "X" } }), GalatAksi);
    assert.deepEqual(bacaPerubahanKamar({ catatan: "  " }), { catatan: null });
    assert.throws(() => bacaPerubahanKamar({}), GalatAksi);
    assert.throws(() => bacaPerubahanKamar({ hargaSewa: -1 }), GalatAksi);
    assert.throws(() => bacaPerubahanKamar({ aktif: "ya" }), GalatAksi);
  });
});
