import type { Metadata } from "next";
import Link from "next/link";

import { FormNomorWa } from "@/components/auth/form-nomor-wa";
import { HREF_MULAI } from "@/components/landing/links";

export const metadata: Metadata = {
  title: "Masuk",
  description: "Masuk ke Kostera dengan nomor WhatsApp — tanpa password.",
};

/** Masuk memakai alur yang sama dengan daftar: nomor WhatsApp → kode OTP. */
export default function MasukPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Masuk ke Kostera</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pakai nomor WhatsApp yang terdaftar. Kami kirim kode untuk memastikan itu kamu.
        </p>
      </div>

      <FormNomorWa />

      <p className="text-center text-sm text-muted-foreground">
        Belum punya akun?{" "}
        <Link href={HREF_MULAI} className="inline-flex min-h-11 items-center font-medium text-primary hover:underline">
          Daftarkan kos
        </Link>
      </p>
    </div>
  );
}
