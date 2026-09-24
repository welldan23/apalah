// Pemanggil endpoint Better Auth dari browser. Galat dikembalikan sebagai Error berpesan bahasa Indonesia.

const PESAN_GALAT: Record<string, string> = {
  INVALID_PHONE_NUMBER: "Nomor WhatsApp tidak valid, contoh 0812 3456 7890.",
  OTP_EXPIRED: "Kode sudah kedaluwarsa. Minta kode baru.",
  INVALID_OTP: "Kode salah. Cek lagi pesan WhatsApp-nya.",
  OTP_NOT_FOUND: "Kode sudah tidak berlaku. Minta kode baru.",
  TOO_MANY_ATTEMPTS: "Terlalu banyak percobaan. Minta kode baru.",
};

/** Pesan untuk pengguna dari status HTTP & kode galat Better Auth. */
export function pesanGalatAuth(status: number, code?: string, message?: string) {
  if (status === 429) return "Terlalu sering meminta kode. Tunggu beberapa menit lalu coba lagi.";
  if (code && PESAN_GALAT[code]) return PESAN_GALAT[code];
  // Pesan dari server Kostera sendiri (mis. OTP gagal terkirim) sudah berbahasa Indonesia.
  if (code === "OTP_GAGAL_TERKIRIM" && message) return message;
  return "Terjadi kesalahan. Coba lagi sebentar lagi.";
}

/** Galat dari endpoint auth; `kode` = kode galat Better Auth, mis. "INVALID_OTP". */
export class GalatAuth extends Error {
  kode?: string;
  status: number;
  constructor(pesan: string, status: number, kode?: string) {
    super(pesan);
    this.status = status;
    this.kode = kode;
  }
}

/** Kode yang berarti kode OTP sudah tidak bisa dipakai lagi — harus minta kode baru. */
export const KODE_OTP_HANGUS = ["TOO_MANY_ATTEMPTS", "OTP_EXPIRED", "OTP_NOT_FOUND"];

export async function panggilAuth<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/auth${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new GalatAuth("Tidak bisa terhubung ke server. Cek koneksi internet lalu coba lagi.", 0);
  }
  const data = (await res.json().catch(() => ({}))) as { code?: string; message?: string };
  if (!res.ok) throw new GalatAuth(pesanGalatAuth(res.status, data.code, data.message), res.status, data.code);
  return data as T;
}
