import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { and, eq } from "drizzle-orm";

import type { Db } from "../../db/index.ts";
import * as schema from "../../db/schema.ts";
import { isiDataContoh } from "../../db/seed.ts";
import { buatDbUji } from "../../db/testing.ts";
import { cariPilihanWorkspace, cocokkanNomorWa, pilihWorkspace } from "./workspace.ts";

const PERCAKAPAN_OWNER = "wac_owner_kos_melati";

describe("cocokkanNomorWa", () => {
  let db: Db;
  let tutup: () => Promise<void>;

  const percakapan = async (id: string, nomorWa: string) => {
    await db.insert(schema.waConversations).values({ id, nomorWa });
    return id;
  };
  const tautan = async (id: string) =>
    (await db
      .select({ userId: schema.waConversations.userId, org: schema.waConversations.organizationId })
      .from(schema.waConversations)
      .where(eq(schema.waConversations.id, id)))[0];

  before(async () => {
    ({ db, tutup } = await buatDbUji());
    await isiDataContoh(db);
    await db.insert(schema.users).values([
      { id: "usr_penyewa", nama: "Dimas", nomorWa: "6281300000011", nomorWaTerverifikasi: true },
      { id: "usr_belum", nama: "Belum OTP", nomorWa: "6281300000012", nomorWaTerverifikasi: false },
    ]);
    await db.insert(schema.members).values([
      { organizationId: "org_kos_melati", userId: "usr_penyewa", peran: "penyewa" },
      { organizationId: "org_kos_melati", userId: "usr_belum", peran: "admin" },
    ]);
  });
  after(() => tutup());

  it("owner multi-kos: kos aktif sebelumnya dipertahankan, daftar kos urut nama", async () => {
    const k = await cocokkanNomorWa(db, PERCAKAPAN_OWNER);
    assert.equal(k.status, "siap");
    assert.ok(k.status === "siap");
    assert.equal(k.userId, "usr_ratna");
    assert.equal(k.workspace.id, "org_kos_melati");
    assert.deepEqual(k.workspaces.map((w) => [w.namaKos, w.peran]), [
      ["Griya Asri", "admin"],
      ["Kos Mawar", "owner"],
      ["Kos Melati", "owner"],
    ]);
  });

  it("belum memilih kos → diminta memilih; pilihan disimpan bila berhak", async () => {
    await db.update(schema.waConversations).set({ organizationId: null }).where(eq(schema.waConversations.id, PERCAKAPAN_OWNER));
    const k = await cocokkanNomorWa(db, PERCAKAPAN_OWNER);
    assert.equal(k.status, "pilih_workspace");

    const dipilih = await pilihWorkspace(db, PERCAKAPAN_OWNER, "org_griya_asri");
    assert.equal(dipilih?.workspace.namaKos, "Griya Asri");
    assert.deepEqual(await tautan(PERCAKAPAN_OWNER), { userId: "usr_ratna", org: "org_griya_asri" });
    assert.equal(await pilihWorkspace(db, PERCAKAPAN_OWNER, "org_tidak_ada"), null);
  });

  it("keanggotaan dinonaktifkan → kos itu tidak bisa diakses lagi", async () => {
    await db
      .update(schema.members)
      .set({ status: "nonaktif" })
      .where(and(eq(schema.members.organizationId, "org_griya_asri"), eq(schema.members.userId, "usr_ratna")));
    const k = await cocokkanNomorWa(db, PERCAKAPAN_OWNER);
    assert.equal(k.status, "pilih_workspace");
    assert.ok(k.status === "pilih_workspace" && k.workspaces.every((w) => w.id !== "org_griya_asri"));
    assert.equal((await tautan(PERCAKAPAN_OWNER)).org, null);
  });

  it("satu kos → langsung dipakai", async () => {
    const id = await percakapan("wac_hendra", "6281377009900");
    const k = await cocokkanNomorWa(db, id);
    assert.ok(k.status === "siap");
    assert.equal(k.workspace.id, "org_griya_asri");
    assert.deepEqual(await tautan(id), { userId: "usr_pemilik_griya", org: "org_griya_asri" });
  });

  it("nomor asing atau belum terverifikasi → tidak dikenal, tanpa tautan", async () => {
    for (const [id, nomor] of [["wac_asing", "6285700000001"], ["wac_belum", "6281300000012"]]) {
      await percakapan(id, nomor);
      assert.deepEqual(await cocokkanNomorWa(db, id), { status: "tidak_dikenal" });
      assert.deepEqual(await tautan(id), { userId: null, org: null });
    }
  });

  it("penyewa tidak memakai Kosta sebagai copilot", async () => {
    const id = await percakapan("wac_penyewa", "6281300000011");
    assert.deepEqual(await cocokkanNomorWa(db, id), { status: "tanpa_akses", userId: "usr_penyewa" });
    assert.equal(await pilihWorkspace(db, id, "org_kos_melati"), null);
    assert.deepEqual(await tautan(id), { userId: "usr_penyewa", org: null });
  });
});

describe("cariPilihanWorkspace", () => {
  const ws = [
    { id: "a", namaKos: "Griya Asri", jumlahKamar: 20, peran: "admin" as const },
    { id: "b", namaKos: "Kos Mawar", jumlahKamar: 12, peran: "owner" as const },
    { id: "c", namaKos: "Kos Melati", jumlahKamar: 40, peran: "owner" as const },
  ];
  it("nomor urut atau potongan nama yang unik", () => {
    assert.equal(cariPilihanWorkspace(" 2 ", ws)?.id, "b");
    assert.equal(cariPilihanWorkspace("melati", ws)?.id, "c");
    assert.equal(cariPilihanWorkspace("Kos", ws), null); // lebih dari satu cocok
    assert.equal(cariPilihanWorkspace("9", ws), null);
    assert.equal(cariPilihanWorkspace("0", ws), null);
    assert.equal(cariPilihanWorkspace("as", ws), null); // terlalu pendek
  });
});
