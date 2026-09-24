import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { and, eq } from "drizzle-orm";

import type { Db } from "../../db/index.ts";
import * as schema from "../../db/schema.ts";
import { isiDataContoh } from "../../db/seed.ts";
import { buatDbUji } from "../../db/testing.ts";
import { GalatAksi } from "../aksi/galat.ts";
import { daftarKeanggotaanAktif, pilihWorkspaceAktif, tentukanWorkspace } from "./workspace.ts";

describe("sesi & pembatasan akses organisasi", () => {
  let db: Db;
  let tutup: () => Promise<void>;
  const sesiBaru = async (id: string, userId: string, organizationId: string | null = null) => {
    await db.insert(schema.sessions).values({ id, userId, token: `tok_${id}`, kedaluwarsaPada: new Date(Date.now() + 86_400_000), organizationId });
    return { userId, sessionId: id, organizationId };
  };
  const kosAktif = async (id: string) =>
    (await db.select({ o: schema.sessions.organizationId }).from(schema.sessions).where(eq(schema.sessions.id, id)))[0].o;

  before(async () => {
    ({ db, tutup } = await buatDbUji());
    await isiDataContoh(db);
  });
  after(() => tutup());

  it("daftar workspace: semua keanggotaan aktif dengan perannya, urut nama kos", async () => {
    assert.deepEqual(
      (await daftarKeanggotaanAktif(db, "usr_ratna")).map((w) => [w.namaKos, w.peran, w.jumlahKamar]),
      [
        ["Griya Asri", "admin", 20],
        ["Kos Mawar", "owner", 12],
        ["Kos Melati", "owner", 40],
      ],
    );
    assert.deepEqual(await daftarKeanggotaanAktif(db, "usr_tidak_ada"), []);
  });

  it("beberapa kos & belum memilih → pilih kos; kos di sesi dipakai beserta perannya", async () => {
    // Ratna: owner Kos Melati & Kos Mawar, admin Griya Asri.
    assert.deepEqual(await tentukanWorkspace(db, await sesiBaru("s1", "usr_ratna")), { status: "pilih_kos" });
    const hasil = await tentukanWorkspace(db, await sesiBaru("s2", "usr_ratna", "org_griya_asri"));
    assert.ok(hasil.status === "siap");
    assert.deepEqual(hasil.sesi, {
      organization: { id: "org_griya_asri", namaKos: "Griya Asri", alamat: "", jumlahKamar: 20 },
      user: { id: "usr_ratna", nama: "Ratna Wijayanti", nomorWa: "6281234567890" },
      peran: "admin",
    });
  });

  it("satu kos → dipilih otomatis & disimpan di sesi; tanpa kos → siapkan kos; akun tak dikenal → tanpa sesi", async () => {
    const hasil = await tentukanWorkspace(db, await sesiBaru("s3", "usr_pemilik_griya"));
    assert.ok(hasil.status === "siap");
    assert.deepEqual([hasil.sesi.organization.id, hasil.sesi.peran], ["org_griya_asri", "owner"]);
    assert.equal(await kosAktif("s3"), "org_griya_asri");

    await db.insert(schema.users).values({ id: "usr_baru", nama: "6281299990031", nomorWa: "6281299990031" });
    assert.deepEqual(await tentukanWorkspace(db, await sesiBaru("s4", "usr_baru")), { status: "tanpa_kos" });
    assert.deepEqual(await tentukanWorkspace(db, { userId: "usr_hantu", sessionId: "x", organizationId: null }), { status: "tanpa_sesi" });
  });

  it("keanggotaan dinonaktifkan → kos itu tidak bisa dibuka lagi", async () => {
    await db
      .update(schema.members)
      .set({ status: "nonaktif" })
      .where(and(eq(schema.members.userId, "usr_ratna"), eq(schema.members.organizationId, "org_griya_asri")));
    assert.deepEqual(await tentukanWorkspace(db, { userId: "usr_ratna", sessionId: "s2", organizationId: "org_griya_asri" }), {
      status: "pilih_kos",
    });
    await assert.rejects(
      pilihWorkspaceAktif(db, { userId: "usr_ratna", sessionId: "s2" }, "org_griya_asri"),
      (err) => err instanceof GalatAksi && err.status === 403,
    );
    assert.deepEqual((await daftarKeanggotaanAktif(db, "usr_ratna")).map((w) => w.namaKos), ["Kos Mawar", "Kos Melati"]);
  });

  it("pilih kos aktif: hanya kos yang dikelola; sesi orang lain tidak ikut berubah", async () => {
    const kos = await pilihWorkspaceAktif(db, { userId: "usr_ratna", sessionId: "s1" }, "org_kos_mawar");
    assert.deepEqual(kos, { id: "org_kos_mawar", namaKos: "Kos Mawar", alamat: "", jumlahKamar: 12 });
    assert.equal(await kosAktif("s1"), "org_kos_mawar");
    await assert.rejects(
      pilihWorkspaceAktif(db, { userId: "usr_baru", sessionId: "s4" }, "org_kos_melati"),
      (err) => err instanceof GalatAksi && err.status === 403,
    );
    // Sesi s3 milik pengguna lain: tidak berubah walau id sesinya dipakai.
    await pilihWorkspaceAktif(db, { userId: "usr_ratna", sessionId: "s3" }, "org_kos_melati");
    assert.equal(await kosAktif("s3"), "org_griya_asri");
  });
});
