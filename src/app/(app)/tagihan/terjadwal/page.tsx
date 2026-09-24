import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { FormTagihanTerjadwal } from "@/components/tagihan/form-tagihan-terjadwal";
import { getHalamanTagihanTerjadwal } from "@/lib/data/tagihan-terjadwal";

export const metadata: Metadata = {
  title: "Tagihan terjadwal",
};

export default async function TagihanTerjadwalPage() {
  const data = await getHalamanTagihanTerjadwal();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 lg:gap-6">
      <header>
        <Link
          href="/tagihan"
          className="-ml-1 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Tagihan &amp; Invoice
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Tagihan terjadwal</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tagihan sewa terbit otomatis tiap bulan untuk semua kamar terisi, tanpa perlu dibuat
          manual.
        </p>
      </header>

      <FormTagihanTerjadwal {...data} />
    </div>
  );
}
