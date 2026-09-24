import type { Metadata } from "next";
import Link from "next/link";

import { FormNomorWa } from "@/components/auth/form-nomor-wa";
import { HREF_MASUK } from "@/components/landing/links";
import { normalisasiNomorWa } from "@/lib/nomor-wa";

export const metadata: Metadata = {
  title: "Daftarkan kos",
  description: "Daftar Kostera cukup dengan nomor WhatsApp — tanpa password.",
};

export default async function DaftarPage({ searchParams }: PageProps<"/daftar">) {
  const { nomor } = await searchParams;
  const nomorAwal = typeof nomor === "string" ? (normalisasiNomorWa(nomor) ?? undefined) : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Daftarkan kos kamu</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cukup nomor WhatsApp — tanpa password. Kami kirim kode untuk memastikan nomor ini milikmu.
        </p>
      </div>

      <FormNomorWa nomorAwal={nomorAwal} />

      <p className="text-center text-sm text-muted-foreground">
        Sudah punya akun?{" "}
        <Link href={HREF_MASUK} className="inline-flex min-h-11 items-center font-medium text-primary hover:underline">
          Masuk
        </Link>
      </p>
    </div>
  );
}
