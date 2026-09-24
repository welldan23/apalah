import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { KosteraLogo } from "@/components/app-shell/kostera-logo";
import { PembayaranTagihan } from "@/components/invoice/pembayaran-tagihan";
import { getDb } from "@/db";
import { getInvoicePublik } from "@/lib/data/invoice-publik";
import { formatPeriode, formatRupiah } from "@/lib/format";
import { sisaTagihan } from "@/lib/pembayaran/metode";

// Sama dengan halaman invoice: pribadi, tidak diindeks, token tidak bocor lewat Referer.
export const metadata: Metadata = {
  title: "Bayar tagihan",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** Bayar tagihan lewat tautan (tanpa login): nominal = sisa yang belum dibayar. */
export default async function BayarTagihanPage({ params }: PageProps<"/invoice/[token]/bayar">) {
  const { token } = await params;
  const inv = await getInvoicePublik(await getDb(), token);
  if (!inv) notFound();
  const sisa = sisaTagihan(inv.nominal, inv.sudahDiterima);
  // Sudah lunas / tidak ada yang perlu dibayar → kembali ke rincian.
  if (inv.status === "lunas" || sisa === 0) redirect(`/invoice/${token}`);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-6 sm:py-10">
      <header className="flex items-center justify-between gap-3">
        <KosteraLogo />
        <span className="text-sm text-muted-foreground">Bayar tagihan</span>
      </header>
      <Link
        href={`/invoice/${token}`}
        className="-ml-1 inline-flex min-h-11 w-fit items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        Rincian tagihan
      </Link>

      <section className="rounded-2xl border bg-card p-5">
        <p className="text-sm text-muted-foreground">
          {inv.namaKos} · Kamar {inv.nomorKamar} · {formatPeriode(inv.periode)}
        </p>
        <p className="text-xs text-muted-foreground tabular-nums">{inv.nomorInvoice}</p>
        <p className="mt-3 text-sm text-muted-foreground">{inv.sudahDiterima > 0 ? "Sisa yang perlu dibayar" : "Total yang perlu dibayar"}</p>
        <p className="text-2xl font-semibold tracking-tight tabular-nums">{formatRupiah(sisa)}</p>
        {inv.sudahDiterima > 0 && (
          <p className="text-xs text-muted-foreground">
            Dari tagihan {formatRupiah(inv.nominal)} · sudah dibayar {formatRupiah(inv.sudahDiterima)}
          </p>
        )}
      </section>

      <PembayaranTagihan token={token} nominal={sisa} />
    </main>
  );
}
