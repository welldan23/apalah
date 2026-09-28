import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { WizardTambahKamar } from "@/components/kamar/wizard-tambah-kamar";
import { getHalamanTambahKamar } from "@/lib/data/tambah-kamar";

export const metadata: Metadata = {
  title: "Tambah kos & kamar",
};

export default async function TambahKamarPage() {
  const data = await getHalamanTambahKamar();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <header>
        <Link
          href="/kamar"
          className="-ml-1 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Kamar &amp; Penghuni
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Tambah kos &amp; kamar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Daftarkan kamar per tipe; nomor kamar dibuat otomatis tanpa bentrok.
        </p>
      </header>
      <WizardTambahKamar {...data} />
    </div>
  );
}
