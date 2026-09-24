// Instance Better Auth aplikasi (satu per proses): database aktif + OTP lewat provider WhatsApp.

import { getDb } from "../../db/index.ts";
import { getPengirimWhatsApp } from "../whatsapp/index.ts";
import { buatAuth, type Auth } from "./index.ts";
import { kirimOtpLewatWa } from "./otp-wa.ts";

const global = globalThis as unknown as { kosteraAuth?: Promise<Auth> };

export function getAuth(): Promise<Auth> {
  global.kosteraAuth ??= getDb().then((db) =>
    buatAuth(db, {
      baseURL: process.env.BETTER_AUTH_URL || process.env.APP_URL || "http://localhost:3000",
      kirimOtp: kirimOtpLewatWa(getPengirimWhatsApp()),
    }),
  );
  return global.kosteraAuth;
}

/** Sesi login dari header permintaan (cookie kostera.session_token); null bila belum masuk. */
export async function getSesiLogin(headers: Headers) {
  return (await getAuth()).api.getSession({ headers });
}
