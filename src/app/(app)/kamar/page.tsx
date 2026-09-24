import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { DaftarKamar } from "@/components/kamar/daftar-kamar";
import { Button } from "@/components/ui/button";
import { getHalamanKamar } from "@/lib/data/halaman-kamar";

export const metadata: Metadata = {
  title: "Kamar & Penghuni",
};

export default async function KamarPage() {
  const data = await getHalamanKamar();
  const terisi = data.kamar.filter((k) => k.status === "terisi").length;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 lg:gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Kamar &amp; Penghuni</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.namaKos} · {data.kamar.length} kamar · {terisi} terisi ·{" "}
            {data.kamar.length - terisi} kosong
          </p>
        </div>
        <Button asChild variant="outline" size="lg" className="h-10 self-start sm:self-auto">
          <Link href="/kamar/tambah">
            <Plus data-icon="inline-start" />
            Tambah kos &amp; kamar
          </Link>
        </Button>
      </header>

      <DaftarKamar kamar={data.kamar} />
    </div>
  );
}
