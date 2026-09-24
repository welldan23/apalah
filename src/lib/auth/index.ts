// Better Auth untuk Kostera: pemilik/admin kos masuk cukup dengan nomor WhatsApp + kode OTP
// (plugin phone-number, akun dibuat otomatis saat nomor pertama kali terverifikasi). Tabel & kolom
// Better Auth dipetakan ke skema Kostera: users, sessions, accounts, verifications, rate_limits.

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { phoneNumber } from "better-auth/plugins/phone-number";

import { schema, type Db } from "../../db/index.ts";
import { normalisasiNomorWa } from "../nomor-wa.ts";
import { MAKS_PERCOBAAN_OTP, MASA_BERLAKU_OTP_MENIT, PANJANG_OTP } from "../otp.ts";

export type KonfigurasiAuth = {
  /** Rahasia penandatangan cookie sesi; kosong = Better Auth membaca BETTER_AUTH_SECRET. */
  secret?: string;
  /** Alamat aplikasi, mis. https://kostera.id. */
  baseURL: string;
  /** Kirim kode OTP ke nomor WhatsApp (format 628…). */
  kirimOtp: (nomorWa: string, kode: string) => Promise<void>;
  /** Batasi jumlah permintaan per IP; bawaan hanya di produksi. */
  batasPermintaan?: boolean;
};

/** Batas permintaan OTP per IP: kirim kode (biaya WhatsApp) & tebak kode. */
export const ATURAN_BATAS = {
  "/phone-number/send-otp": { window: 10 * 60, max: 5 },
  "/phone-number/verify": { window: 60, max: 10 },
};

/** Better Auth mewajibkan email; akun dari nomor WA memakai email sementara ini. */
export const emailSementara = (nomorWa: string) => `${nomorWa}@wa.kostera.id`;

export function buatAuth(db: Db, { secret, baseURL, kirimOtp, batasPermintaan }: KonfigurasiAuth) {
  const waktu = { createdAt: "dibuatPada", updatedAt: "diperbaruiPada" };
  return betterAuth({
    secret,
    baseURL,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        users: schema.users,
        sessions: schema.sessions,
        accounts: schema.accounts,
        verifications: schema.verifications,
        rateLimits: schema.rateLimits,
      },
    }),
    advanced: { cookiePrefix: "kostera", database: { generateId: "uuid" } },
    user: {
      modelName: "users",
      fields: { name: "nama", emailVerified: "emailTerverifikasi", image: "foto", ...waktu },
    },
    session: {
      modelName: "sessions",
      fields: { expiresAt: "kedaluwarsaPada", ipAddress: "alamatIp", ...waktu },
      // Kos (workspace) yang sedang dibuka; diisi server, bukan dari input klien.
      additionalFields: { organizationId: { type: "string", required: false, input: false } },
    },
    account: { modelName: "accounts", fields: waktu },
    verification: { modelName: "verifications", fields: { expiresAt: "kedaluwarsaPada", ...waktu } },
    rateLimit: { enabled: batasPermintaan, storage: "database", modelName: "rateLimits", customRules: ATURAN_BATAS },
    plugins: [
      phoneNumber({
        otpLength: PANJANG_OTP,
        expiresIn: MASA_BERLAKU_OTP_MENIT * 60,
        allowedAttempts: MAKS_PERCOBAAN_OTP,
        // Nomor harus sudah dalam format simpan 628… (dirapikan di form sebelum dikirim).
        phoneNumberValidator: (nomor) => normalisasiNomorWa(nomor) === nomor,
        sendOTP: ({ phoneNumber: nomorWa, code }) => kirimOtp(nomorWa, code),
        // Nama sementara = nomor WA; diganti saat owner mengisi data kos pertama.
        signUpOnVerification: { getTempEmail: emailSementara, getTempName: (nomorWa) => nomorWa },
        schema: { user: { fields: { phoneNumber: "nomorWa", phoneNumberVerified: "nomorWaTerverifikasi" } } },
      }),
    ],
  });
}

export type Auth = ReturnType<typeof buatAuth>;
