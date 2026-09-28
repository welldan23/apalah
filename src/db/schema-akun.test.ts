import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { eq } from "drizzle-orm";

import { buatAuth, emailSementara } from "../lib/auth/index.ts";
import type { Db } from "./index.ts";
import * as schema from "./schema.ts";
import { isiDataContoh } from "./seed.ts";
import { buatDbUji } from "./testing.ts";

const ORG = "org_kos_melati";

describe("skema akun, sesi & workspace (Better Auth)", () => {
  let db: Db;
  let tutup: () => Promise<void>;
  let auth: ReturnType<typeof buatAuth>;
  const kodeTerkirim = new Map<string, string>();

  const ditolakOleh = (query: Promise<unknown>, constraint: string) =>
    assert.rejects(query, (err: Error & { cause?: Error }) => {
      assert.match(err.cause?.message ?? err.message, new RegExp(constraint));
      return true;
    });
  async function masuk(nomorWa: string) {
    await auth.api.sendPhoneNumberOTP({ body: { phoneNumber: nomorWa } });
    return auth.api.verifyPhoneNumber({ body: { phoneNumber: nomorWa, code: kodeTerkirim.get(nomorWa)! } });
  }

  before(async () => {
    ({ db, tutup } = await buatDbUji());
    await isiDataContoh(db);
    auth = buatAuth(db, {
      secret: "rahasia-uji-yang-cukup-panjang-untuk-better-auth",
      baseURL: "http://localhost:3000",
      kirimOtp: async (nomorWa, kode) => {
        kodeTerkirim.set(nomorWa, kode);
      },
    });
  });
  after(() => tutup());

  it("OTP disimpan di verifications; nomor baru → akun dibuat otomatis & sesi aktif", async () => {
    await auth.api.sendPhoneNumberOTP({ body: { phoneNumber: "6281200000001" } });
    const [otp] = await db.select().from(schema.verifications).where(eq(schema.verifications.identifier, "6281200000001"));
    assert.match(otp.value, /^\d{6}:0$/);
    assert.ok(otp.kedaluwarsaPada > new Date());

    const hasil = await auth.api.verifyPhoneNumber({ body: { phoneNumber: "6281200000001", code: kodeTerkirim.get("6281200000001")! } });
    assert.ok(hasil.token);
    const [pengguna] = await db.select().from(schema.users).where(eq(schema.users.nomorWa, "6281200000001"));
    assert.deepEqual(
      [pengguna.nama, pengguna.email, pengguna.nomorWaTerverifikasi, pengguna.emailTerverifikasi],
      ["6281200000001", emailSementara("6281200000001"), true, false],
    );
    const [sesi] = await db.select().from(schema.sessions).where(eq(schema.sessions.token, hasil.token!));
    assert.deepEqual([sesi.userId, sesi.organizationId], [pengguna.id, null]);
    assert.ok(sesi.kedaluwarsaPada > new Date());
    // Kode sekali pakai.
    assert.equal((await db.select().from(schema.verifications).where(eq(schema.verifications.identifier, "6281200000001"))).length, 0);
  });

  it("nomor yang sudah terdaftar masuk ke akun yang sama; nomor tidak berformat 628… ditolak", async () => {
    const hasil = await masuk("6281234567890"); // Ratna, owner Kos Melati
    assert.equal(hasil.user?.id, "usr_ratna");
    await assert.rejects(auth.api.sendPhoneNumberOTP({ body: { phoneNumber: "0812-3456-7890" } }));
  });

  it("workspace aktif sesi hanya kos yang dikelola penggunanya; keluar dari kos mengosongkannya", async () => {
    const { token } = await masuk("6281234567890");
    const set = (organizationId: string | null) =>
      db.update(schema.sessions).set({ organizationId }).where(eq(schema.sessions.token, token!));
    await set(ORG);
    await set("org_griya_asri"); // admin di sana
    await ditolakOleh(set("org_tidak_ada"), "sessions_workspace_anggota_fk");

    await db.delete(schema.members).where(eq(schema.members.organizationId, "org_griya_asri"));
    const [sesi] = await db.select().from(schema.sessions).where(eq(schema.sessions.token, token!));
    assert.deepEqual([sesi.userId, sesi.organizationId], ["usr_ratna", null]);
  });
});
