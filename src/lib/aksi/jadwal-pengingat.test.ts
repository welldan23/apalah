import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { and, eq } from "drizzle-orm";

import type { Db } from "../../db/index.ts";
import * as schema from "../../db/schema.ts";
import { isiDataContoh } from "../../db/seed.ts";
import { buatDbUji } from "../../db/testing.ts";
import { GalatAksi } from "./galat.ts";
import { bacaInputPengaturanPengingat, getPengaturanPengingat, simpanPengaturanPengingat } from "./jadwal-pengingat.ts";

const ORG = "org_kos_melati";
const j = (offsetHari: number, jam = "09:00", aktif = true) => ({ offsetHari, jam, aktif });

describe("jadwal pengingat per kos", () => {
  let db: Db;
  let tutup: () => Promise<void>;
  const idJadwal = async (offsetHari: number) =>
    (
      await db
        .select({ id: schema.reminderSchedules.id })
        .from(schema.reminderSchedules)
        .where(and(eq(schema.reminderSchedules.organizationId, ORG), eq(schema.reminderSchedules.offsetHari, offsetHari)))
    )[0]?.id;

  before(async () => {
    ({ db, tutup } = await buatDbUji());
    await isiDataContoh(db);
  });
  after(() => tutup());

  it("baca: saklar utama + jadwal bawaan urut H-3 → H+3, jam \"HH:MM\"", async () => {
    assert.deepEqual(await getPengaturanPengingat(db, ORG), { otomatisAktif: true, jadwal: [j(-3), j(0), j(3)] });
    await assert.rejects(getPengaturanPengingat(db, "org_lain"), (err) => err instanceof GalatAksi && err.status === 404);
  });

  it("validasi input mengikuti aturan form; hasil diurutkan", () => {
    assert.deepEqual(bacaInputPengaturanPengingat({ otomatisAktif: false, jadwal: [j(3), j(-7, "07:30")] }), {
      otomatisAktif: false,
      jadwal: [j(-7, "07:30"), j(3)],
    });
    const ditolak = (body: Record<string, unknown>, pesan: RegExp) =>
      assert.throws(() => bacaInputPengaturanPengingat(body), (err) => err instanceof GalatAksi && pesan.test(err.message));
    ditolak({ jadwal: [] }, /otomatisAktif/);
    ditolak({ otomatisAktif: true }, /0–5 jadwal/);
    ditolak({ otomatisAktif: true, jadwal: [-5, -3, 0, 3, 5, 7].map((o) => j(o)) }, /0–5 jadwal/);
    ditolak({ otomatisAktif: true, jadwal: [{ offsetHari: "-3", jam: "09:00", aktif: true }] }, /offsetHari \(angka\)/);
    ditolak({ otomatisAktif: true, jadwal: [null] }, /offsetHari/);
    ditolak({ otomatisAktif: true, jadwal: [j(-3), j(-3, "10:00")] }, /Sudah ada jadwal H-3/);
    ditolak({ otomatisAktif: true, jadwal: [j(15)] }, /0–14 hari/);
    ditolak({ otomatisAktif: true, jadwal: [j(1.5)] }, /0–14 hari/);
    ditolak({ otomatisAktif: true, jadwal: [j(0, "22:00")] }, /06\.00 dan 21\.00/);
    ditolak({ otomatisAktif: true, jadwal: [j(0, "9:00")] }, /mis\. 09:00/);
  });

  it("simpan mengganti seluruh set: ubah, hapus, tambah, dan matikan saklar utama", async () => {
    const idH = await idJadwal(0);
    const hasil = await simpanPengaturanPengingat(db, ORG, {
      otomatisAktif: false,
      jadwal: [j(-7, "08:00"), j(-3, "09:00", false), j(0, "10:30")],
    });
    assert.deepEqual(hasil, { otomatisAktif: false, jadwal: [j(-7, "08:00"), j(-3, "09:00", false), j(0, "10:30")] });
    assert.deepEqual(await getPengaturanPengingat(db, ORG), hasil);
    // Jadwal yang tetap ada diperbarui di tempat (bukan dihapus lalu dibuat ulang).
    assert.equal(await idJadwal(0), idH);
    assert.equal(await idJadwal(3), undefined);
  });

  it("set kosong menghapus semua jadwal; kos lain tidak tersentuh", async () => {
    assert.deepEqual(await simpanPengaturanPengingat(db, ORG, { otomatisAktif: true, jadwal: [] }), { otomatisAktif: true, jadwal: [] });
    assert.equal((await getPengaturanPengingat(db, "org_kos_mawar")).jadwal.length, 3);
    await assert.rejects(
      simpanPengaturanPengingat(db, "org_lain", { otomatisAktif: true, jadwal: [] }),
      (err) => err instanceof GalatAksi && err.status === 404,
    );
  });
});
