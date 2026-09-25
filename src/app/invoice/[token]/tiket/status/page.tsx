import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Plus } from "lucide-react";

import { KosteraLogo } from "@/components/app-shell/kostera-logo";
import { DaftarTiket } from "@/components/invoice/daftar-tiket";
import { Button } from "@/components/ui/button";
import { getHalamanStatusTiket } from "@/lib/data/halaman-tiket";

// Sama dengan halaman invoice: pribadi, tidak diindeks, token tidak bocor lewat Referer.
export const metadata: Metadata = {
  title: "Status tiket",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** Status keluhan / permintaan perbaikan penyewa, dibuka lewat tautan invoice (tanpa login). */
export default async function StatusTiketPage({ params }: PageProps<"/invoice/[token]/tiket/status">) {
  const { token } = await params;
  const data = await getHalamanStatusTiket(token);
  if (!data) notFound();
  const aktif = data.tiket.filter((t) => t.status !== "selesai").length;

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
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Status tiket</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Kamar {data.nomorKamar} · {data.namaKos}
            {data.tiket.length > 0 && ` · ${aktif ? `${aktif} masih ditangani` : "semua selesai"}`}
          </p>
        </div>
        {data.tiket.length > 0 && (
          <Button asChild variant="outline" size="lg" className="h-11 shrink-0">
            <Link href={`/invoice/${token}/tiket`}>
              <Plus data-icon="inline-start" />
              Tiket baru
            </Link>
          </Button>
        )}
      </div>
      <DaftarTiket token={token} tiket={data.tiket} />
    </main>
  );
}
