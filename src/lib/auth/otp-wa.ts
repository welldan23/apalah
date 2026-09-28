// Pengiriman kode OTP lewat adapter WhatsApp: teks untuk WAHA/log, template autentikasi untuk
// WhatsApp Cloud API. Bila gagal, pendaftar mendapat pesan yang jelas (bukan galat server mentah).

import { APIError } from "better-auth/api";

import { MASA_BERLAKU_OTP_MENIT } from "../otp.ts";
import { pesanOtp, templateOtp } from "../pesan.ts";
import type { Db } from "../../db/index.ts";
import type { PengirimWhatsApp } from "../whatsapp/index.ts";
import { kirimDanCatat } from "../whatsapp/log.ts";

export const GALAT_KIRIM_OTP = "Kode belum bisa dikirim ke WhatsApp. Pastikan nomornya aktif di WhatsApp, lalu coba lagi.";

/** Log kiriman OTP hanya berisi metadata — kodenya tidak ikut dicatat. */
export function kirimOtpLewatWa(wa: PengirimWhatsApp, db: Pick<Db, "insert">) {
  return async (nomorWa: string, kode: string) => {
    const hasil = await kirimDanCatat(
      db,
      wa,
      { ke: nomorWa, teks: pesanOtp(kode, MASA_BERLAKU_OTP_MENIT), template: templateOtp(kode) },
      { jenis: "otp" },
    );
    if (!hasil.ok) {
      console.error(`[auth] OTP gagal dikirim ke ${nomorWa.slice(0, 5)}…: ${hasil.galat}`);
      throw APIError.from("SERVICE_UNAVAILABLE", { code: "OTP_GAGAL_TERKIRIM", message: GALAT_KIRIM_OTP });
    }
  };
}
