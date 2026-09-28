// Otorisasi endpoint cron: header "Authorization: Bearer <CRON_SECRET>" (format Vercel Cron).
// Tanpa CRON_SECRET di environment, endpoint cron selalu ditolak.

import { createHash, timingSafeEqual } from "node:crypto";

const sidik = (teks: string) => createHash("sha256").update(teks).digest();

export function cronDiizinkan(authorization: string | null, rahasia = process.env.CRON_SECRET) {
  if (!rahasia || !authorization) return false;
  // Bandingkan sidik SHA-256 supaya panjangnya sama dan waktunya konstan.
  return timingSafeEqual(sidik(authorization), sidik(`Bearer ${rahasia}`));
}
