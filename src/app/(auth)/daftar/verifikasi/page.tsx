import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { FormOtp } from "@/components/auth/form-otp";
import { normalisasiNomorWa, tampilNomorWa } from "@/lib/nomor-wa";
import { PANJANG_OTP } from "@/lib/otp";

export const metadata: Metadata = {
  title: "Verifikasi nomor",
  robots: { index: false, follow: false },
};

export default async function VerifikasiPage({ searchParams }: PageProps<"/daftar/verifikasi">) {
  const { nomor } = await searchParams;
  const nomorWa = typeof nomor === "string" ? normalisasiNomorWa(nomor) : null;
  if (!nomorWa) redirect("/daftar");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/daftar?nomor=${nomorWa}`}
          className="-ml-1 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Ganti nomor
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Masukkan kode verifikasi</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kode {PANJANG_OTP} digit sudah dikirim lewat WhatsApp ke{" "}
          <span className="font-medium whitespace-nowrap text-foreground tabular-nums">{tampilNomorWa(nomorWa)}</span>.
        </p>
      </div>
      <FormOtp nomorWa={nomorWa} />
    </div>
  );
}
