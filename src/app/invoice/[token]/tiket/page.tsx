import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { KosteraLogo } from "@/components/app-shell/kostera-logo";
import { FormTiket } from "@/components/invoice/form-tiket";
import { getDb } from "@/db";
import { getInvoicePublik } from "@/lib/data/invoice-publik";

// Sama dengan halaman invoice: pribadi, tidak diindeks, token tidak bocor lewat Referer.
export const metadata: Metadata = {
  title: "Buat tiket keluhan",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** Keluhan / permintaan perbaikan dari penyewa lewat tautan invoice (tanpa login). */
export default async function BuatTiketPage({ params }: PageProps<"/invoice/[token]/tiket">) {
  const { token } = await params;
  const inv = await getInvoicePublik(await getDb(), token);
  if (!inv) notFound();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-6 sm:py-10">
      <header className="flex items-center justify-between gap-3">
        <KosteraLogo />
        <span className="text-sm text-muted-foreground">Tiket keluhan</span>
      </header>
      <Link
        href={`/invoice/${token}`}
        className="-ml-1 inline-flex min-h-11 w-fit items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        Rincian tagihan
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Laporkan masalah</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {inv.namaPenghuni} · Kamar {inv.nomorKamar} · {inv.namaKos}. Laporanmu langsung sampai ke pemilik kos, tanpa
          tercampur obrolan lain.
        </p>
      </div>
      <FormTiket token={token} namaKos={inv.namaKos} />
    </main>
  );
}
