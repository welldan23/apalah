// Aturan kode OTP verifikasi nomor WhatsApp — dipakai halaman verifikasi dan (nanti) endpoint OTP.

export const PANJANG_OTP = 6;
/** Kode berlaku sejak dikirim. */
export const MASA_BERLAKU_OTP_MENIT = 5;
/** Jeda sebelum boleh minta kode baru. */
export const JEDA_KIRIM_ULANG_DETIK = 60;
/** Salah kode sebanyak ini → harus minta kode baru. */
export const MAKS_PERCOBAAN_OTP = 5;

/** Ambil digit saja (mis. dari tempelan "123 456"), maksimal PANJANG_OTP. */
export const bersihkanKodeOtp = (input: string) => input.replace(/\D/g, "").slice(0, PANJANG_OTP);

/** 75 → "1:15", 9 → "0:09". */
export const formatHitungMundur = (detik: number) => `${Math.floor(detik / 60)}:${String(detik % 60).padStart(2, "0")}`;
