import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { DaftarKamarKosong } from "@/components/kamar/daftar-kamar-kosong";
import { getHalamanKamarKosong } from "@/lib/data/halaman-kamar-kosong";

export const metadata: Metadata = {
  title: "Kamar kosong",
};

export default async function KamarKosongPage() {
  const data = await getHalamanKamarKosong();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 lg:gap-6">
      <header>
        <Link
          href="/kamar"
          className="-ml-1 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Kamar &amp; Penghuni
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Kamar kosong</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {data.namaKos} · {data.kamar.length} dari {data.totalKamar} kamar siap ditawarkan
        </p>
      </header>
      <DaftarKamarKosong kamar={data.kamar} hariIni={data.hariIni} />
    </div>
  );
}
