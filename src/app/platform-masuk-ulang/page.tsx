import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { KosteraLogo } from "@/components/app-shell/kostera-logo";
import { TombolKeluar } from "@/components/auth/tombol-keluar";
import { getAksesPlatform } from "@/lib/data/platform";
import { MAKS_UMUR_SESI_PLATFORM_JAM } from "@/lib/platform/akses";

export const metadata: Metadata = { title: "Masuk ulang", robots: { index: false, follow: false } };

/** Sesi platform admin yang sudah lebih dari 12 jam harus masuk ulang dengan OTP baru. */
export default async function MasukUlangPlatformPage() {
  const akses = await getAksesPlatform();
  if (akses.status === "tanpa_sesi") redirect("/masuk");
  if (akses.status === "bukan_admin") notFound();
  if (akses.status === "admin") redirect("/platform");
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-10">
      <KosteraLogo />
      <h1 className="text-2xl font-semibold tracking-tight">Masuk ulang dulu</h1>
      <p className="text-sm text-muted-foreground">
        Konsol platform hanya bisa dibuka dengan sesi yang dibuat kurang dari {MAKS_UMUR_SESI_PLATFORM_JAM} jam lalu. Keluar,
        lalu masuk lagi dengan kode OTP baru.
      </p>
      <TombolKeluar />
    </main>
  );
}
