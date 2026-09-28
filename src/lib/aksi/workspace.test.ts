import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { eq } from "drizzle-orm";

import type { Db } from "../../db/index.ts";
import * as schema from "../../db/schema.ts";
import { isiDataContoh } from "../../db/seed.ts";
import { buatDbUji } from "../../db/testing.ts";
import { GalatAksi } from "./galat.ts";
import { getPengaturanPengingat } from "./jadwal-pengingat.ts";
import { bacaInputWorkspace, buatWorkspacePertama } from "./workspace.ts";

describe("otomatisasi workspace & organisasi", () => {
  let db: Db;
  let tutup: () => Promise<void>;
  const DATA = { namaPemilik: "Sari Wulandari", namaKos: "Kos Anggrek", jumlahKamar: 24 };

  /** Pengguna baru hasil OTP (nama sementara = nomor WA) beserta sesinya. */
  async function penggunaBaru(id: string, nomorWa: string) {
    await db.insert(schema.users).values({ id, nama: nomorWa, nomorWa, nomorWaTerverifikasi: true, email: `${nomorWa}@wa.kostera.id` });
    await db.insert(schema.sessions).values({ id: `ses_${id}`, userId: id, token: `tok_${id}`, kedaluwarsaPada: new Date(Date.now() + 86_400_000) });
    return { userId: id, sessionId: `ses_${id}` };
  }

  before(async () => {
    ({ db, tutup } = await buatDbUji());
    await isiDataContoh(db);
  });
  after(() => tutup());

  it("satu langkah: nama pemilik, kos, owner, jadwal pengingat bawaan, dan kos aktif di sesi", async () => {
    const akun = await penggunaBaru("usr_sari", "6281299990021");
    const { organizationId, namaKos } = await buatWorkspacePertama(db, akun, DATA);
    assert.equal(namaKos, "Kos Anggrek");

    const [pengguna] = await db.select().from(schema.users).where(eq(schema.users.id, "usr_sari"));
    assert.equal(pengguna.nama, "Sari Wulandari");
    const [kos] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, organizationId));
    assert.deepEqual([kos.namaKos, kos.jumlahKamar, kos.ownerId, kos.pengingatOtomatis], ["Kos Anggrek", 24, "usr_sari", true]);
    const anggota = await db.select().from(schema.members).where(eq(schema.members.organizationId, organizationId));
    assert.deepEqual(anggota.map((m) => [m.userId, m.peran, m.status]), [["usr_sari", "owner", "aktif"]]);
    assert.equal((await getPengaturanPengingat(db, organizationId)).jadwal.length, 3);
    const [sesi] = await db.select().from(schema.sessions).where(eq(schema.sessions.id, "ses_usr_sari"));
    assert.equal(sesi.organizationId, organizationId);
  });

  it("kirim ganda (berurutan maupun bersamaan) hanya membuat satu kos", async () => {
    await assert.rejects(
      buatWorkspacePertama(db, { userId: "usr_sari", sessionId: "ses_usr_sari" }, DATA),
      (err) => err instanceof GalatAksi && err.status === 409,
    );
    const akun = await penggunaBaru("usr_dobel", "6281299990022");
    const hasil = await Promise.allSettled([buatWorkspacePertama(db, akun, DATA), buatWorkspacePertama(db, akun, DATA)]);
    assert.deepEqual(hasil.map((h) => h.status).sort(), ["fulfilled", "rejected"]);
    assert.equal((await db.select().from(schema.organizations).where(eq(schema.organizations.ownerId, "usr_dobel"))).length, 1);
  });

  it("pengguna yang sudah mengelola kos lain ditolak; akun tak dikenal 404", async () => {
    await assert.rejects(
      buatWorkspacePertama(db, { userId: "usr_ratna", sessionId: "x" }, DATA),
      (err) => err instanceof GalatAksi && err.status === 409,
    );
    await assert.rejects(
      buatWorkspacePertama(db, { userId: "usr_hantu", sessionId: "x" }, DATA),
      (err) => err instanceof GalatAksi && err.status === 404,
    );
  });

  it("validasi input mengikuti form", () => {
    assert.deepEqual(bacaInputWorkspace({ namaPemilik: " Sari ", namaKos: " Kos Anggrek ", jumlahKamar: 24 }), {
      namaPemilik: "Sari",
      namaKos: "Kos Anggrek",
      jumlahKamar: 24,
    });
    const ditolak = (body: Record<string, unknown>, pesan: RegExp) =>
      assert.throws(() => bacaInputWorkspace(body), (err) => err instanceof GalatAksi && pesan.test(err.message));
    ditolak({ namaKos: "Kos", jumlahKamar: 5 }, /Isi nama kamu/);
    ditolak({ namaPemilik: "Sari", namaKos: "K", jumlahKamar: 5 }, /Nama kos 2–80/);
    ditolak({ namaPemilik: "Sari", namaKos: "Kos", jumlahKamar: "24" }, /Jumlah kamar 1–500/);
    ditolak({ namaPemilik: "Sari", namaKos: "Kos", jumlahKamar: 501 }, /Jumlah kamar 1–500/);
  });
});
