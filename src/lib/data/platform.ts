// Sesi konsol platform (platform_admin) untuk halaman & route handler. Non-admin mendapat 404 —
// keberadaan konsol tidak diakui. Sesi yang lebih tua dari 12 jam harus masuk ulang (OTP baru).

import { cache } from "react";
import { notFound, redirect } from "next/navigation";

import { getDb } from "@/db";
import { GalatAksi } from "@/lib/aksi/galat";
import { getSesiPengguna } from "@/lib/data/session";
import { periksaAksesPlatform } from "@/lib/platform/akses";

const bacaAkses = cache(async () => {
  const sesi = await getSesiPengguna();
  if (!sesi) return { status: "tanpa_sesi" as const };
  return periksaAksesPlatform(await getDb(), { userId: sesi.user.id, sesiDibuatPada: new Date(sesi.session.createdAt) });
});

/** Untuk layout & halaman /platform: mengembalikan userId admin, atau mengalihkan / 404. */
export async function pastikanPlatformAdmin(): Promise<string> {
  const akses = await bacaAkses();
  if (akses.status === "tanpa_sesi") redirect("/masuk");
  if (akses.status === "bukan_admin") notFound();
  if (akses.status === "sesi_lama") redirect("/platform-masuk-ulang");
  return akses.userId;
}

/** Status mentah (untuk halaman masuk ulang). */
export const getAksesPlatform = bacaAkses;

/** Untuk route handler /api/platform: 401 tanpa sesi/sesi lama, 404 bukan admin. */
export async function pastikanPlatformAdminApi(): Promise<string> {
  const akses = await bacaAkses();
  if (akses.status === "tanpa_sesi") throw new GalatAksi("Sesi berakhir. Masuk lagi dengan nomor WhatsApp.", 401);
  if (akses.status === "bukan_admin") throw new GalatAksi("Tidak ditemukan.", 404);
  if (akses.status === "sesi_lama") throw new GalatAksi("Masuk ulang dengan kode OTP baru untuk membuka konsol platform.", 401);
  return akses.userId;
}
