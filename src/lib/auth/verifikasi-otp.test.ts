import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { eq } from "drizzle-orm";

import type { Db } from "../../db/index.ts";
import * as schema from "../../db/schema.ts";
import { isiDataContoh } from "../../db/seed.ts";
import { buatDbUji } from "../../db/testing.ts";
import { buatAuth } from "./index.ts";

const BASE = "http://localhost:3000";

describe("endpoint kirim & verifikasi OTP", () => {
  let db: Db;
  let tutup: () => Promise<void>;
  let auth: ReturnType<typeof buatAuth>;
  const kode = new Map<string, string>();

  const minta = (path: string, body: unknown, cookie?: string) =>
    auth.handler(
      new Request(`${BASE}/api/auth${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: { "content-type": "application/json", origin: BASE, ...(cookie ? { cookie } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
  const kirim = (phoneNumber: string) => minta("/phone-number/send-otp", { phoneNumber });
  const verifikasi = (phoneNumber: string, code: string) => minta("/phone-number/verify", { phoneNumber, code });
  const kodeGalat = async (res: Response) => ((await res.json()) as { code: string }).code;
  /** Kode yang pasti salah (beda dari kode yang terkirim). */
  const salah = (nomor: string) => (kode.get(nomor) === "000000" ? "111111" : "000000");

  before(async () => {
    ({ db, tutup } = await buatDbUji());
    await isiDataContoh(db);
    auth = buatAuth(db, {
      secret: "rahasia-uji-yang-cukup-panjang-untuk-better-auth",
      baseURL: BASE,
      kirimOtp: async (nomorWa, k) => {
        kode.set(nomorWa, k);
      },
    });
  });
  after(() => tutup());

  it("kode benar → cookie sesi kostera dipasang dan sesi bisa dibaca; kode tidak bisa dipakai ulang", async () => {
    await kirim("6281234567890");
    const res = await verifikasi("6281234567890", kode.get("6281234567890")!);
    assert.equal(res.status, 200);
    const cookie = res.headers.get("set-cookie") ?? "";
    assert.match(cookie, /kostera\.session_token=[^;]+; .*HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);

    const sesi = await minta("/get-session", undefined, cookie.split(";")[0]);
    const data = (await sesi.json()) as { user: { id: string; nomorWa?: string; phoneNumber?: string }; session: { organizationId: string | null } };
    assert.equal(data.user.id, "usr_ratna");
    assert.equal(data.session.organizationId ?? null, null);

    const ulang = await verifikasi("6281234567890", kode.get("6281234567890")!);
    assert.equal(ulang.status, 400);
    assert.equal(await kodeGalat(ulang), "OTP_NOT_FOUND");
  });

  it("kode salah ditolak; setelah 5 kali salah kode hangus walau kemudian benar", async () => {
    await kirim("6281299990011");
    for (let i = 0; i < 5; i++) {
      const res = await verifikasi("6281299990011", salah("6281299990011"));
      assert.equal(await kodeGalat(res), "INVALID_OTP");
    }
    const hangus = await verifikasi("6281299990011", kode.get("6281299990011")!);
    assert.equal(hangus.status, 403);
    assert.equal(await kodeGalat(hangus), "TOO_MANY_ATTEMPTS");
    assert.equal((await db.select().from(schema.users).where(eq(schema.users.nomorWa, "6281299990011"))).length, 0);

    // Minta kode baru → bisa masuk, akun baru dibuat.
    await kirim("6281299990011");
    assert.equal((await verifikasi("6281299990011", kode.get("6281299990011")!)).status, 200);
    assert.equal((await db.select().from(schema.users).where(eq(schema.users.nomorWa, "6281299990011"))).length, 1);
  });

  it("kode kedaluwarsa (lewat 5 menit) ditolak", async () => {
    await kirim("6281299990012");
    await db
      .update(schema.verifications)
      .set({ kedaluwarsaPada: new Date(Date.now() - 1000) })
      .where(eq(schema.verifications.identifier, "6281299990012"));
    const res = await verifikasi("6281299990012", kode.get("6281299990012")!);
    assert.equal(res.status, 400);
    assert.equal(await kodeGalat(res), "OTP_EXPIRED");
  });

  it("kode baru menggantikan kode lama", async () => {
    await kirim("6281299990013");
    const lama = kode.get("6281299990013")!;
    await kirim("6281299990013");
    const baru = kode.get("6281299990013")!;
    if (lama !== baru) assert.equal(await kodeGalat(await verifikasi("6281299990013", lama)), "INVALID_OTP");
    assert.equal((await verifikasi("6281299990013", baru)).status, 200);
  });
});
