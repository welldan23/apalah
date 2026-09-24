import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CircleCheck, Eye, MessageCircle } from "lucide-react";

import { KosteraLogo } from "@/components/app-shell/kostera-logo";
import { InvoiceStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { getDb } from "@/db";
import { getInvoicePublik } from "@/lib/data/invoice-publik";
import { formatPeriode, formatRupiah, formatTanggal } from "@/lib/format";
import { keteranganWaktu } from "@/lib/invoice";
import { cn } from "@/lib/utils";
import { hariIniWib } from "@/lib/waktu";

// Link invoice bersifat pribadi: jangan diindeks, dan jangan bocorkan token lewat Referer.
export const metadata: Metadata = {
  title: "Invoice sewa",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** Invoice publik: penyewa membuka rincian tagihannya lewat link, tanpa login. */
export default async function InvoicePublikPage({ params }: PageProps<"/invoice/[token]">) {
  const { token } = await params;
  const inv = await getInvoicePublik(await getDb(), token);
  if (!inv) notFound();

  const waktu = keteranganWaktu(inv, hariIniWib());
  const pesanWa = `Halo, saya ${inv.namaPenghuni} (kamar ${inv.nomorKamar}). Saya mau konfirmasi tagihan ${inv.nomorInvoice} sebesar ${formatRupiah(inv.nominal)}.`;
  const linkWa = `https://wa.me/${inv.nomorWaPemilik}?text=${encodeURIComponent(pesanWa)}`;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-6 sm:py-10">
      <header className="flex items-center justify-between gap-3">
        <KosteraLogo />
        <span className="text-sm text-muted-foreground">Invoice sewa</span>
      </header>

      <section
        aria-labelledby="invoice-judul"
        className="flex flex-col gap-5 rounded-2xl border bg-card p-5 shadow-xs"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 id="invoice-judul" className="text-lg font-semibold tracking-tight">
              {inv.namaKos}
            </h1>
            {inv.alamatKos && <p className="text-sm text-muted-foreground">{inv.alamatKos}</p>}
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">{inv.nomorInvoice}</p>
          </div>
          <InvoiceStatusBadge status={inv.status} className="shrink-0" />
        </div>

        <div>
          <p className="text-sm text-muted-foreground">Total tagihan</p>
          <p className="text-3xl font-semibold tracking-tight tabular-nums">
            {formatRupiah(inv.nominal)}
          </p>
          <p className={cn("mt-1 text-sm text-muted-foreground", waktu.telat && "text-danger")}>
            {inv.status === "lunas"
              ? waktu.teks
              : `Jatuh tempo ${formatTanggal(inv.jatuhTempo)} · ${waktu.teks}`}
          </p>
        </div>

        <dl className="divide-y rounded-lg border text-sm">
          {(
            [
              ["Penghuni", inv.namaPenghuni],
              ["Kamar", `${inv.nomorKamar} · ${inv.tipeKamar}`],
              ["Periode", formatPeriode(inv.periode)],
              ["Diterbitkan", formatTanggal(inv.diterbitkanPada)],
            ] as const
          ).map(([label, nilai]) => (
            <div key={label} className="flex items-start justify-between gap-4 px-3 py-2.5">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-right font-medium">{nilai}</dd>
            </div>
          ))}
        </dl>

        <section aria-labelledby="rincian-judul">
          <h2 id="rincian-judul" className="mb-2 text-sm font-medium">
            Rincian
          </h2>
          <div className="flex items-start justify-between gap-4 text-sm">
            <span>
              Sewa kamar {inv.nomorKamar} · {formatPeriode(inv.periode)}
            </span>
            <span className="font-medium tabular-nums">{formatRupiah(inv.nominal)}</span>
          </div>
          <div className="mt-3 flex items-center justify-between gap-4 border-t pt-3 font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatRupiah(inv.nominal)}</span>
          </div>
        </section>
      </section>

      {inv.status === "lunas" ? (
        <p className="flex items-start gap-2 rounded-xl bg-success-soft px-4 py-3 text-sm text-success">
          <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Lunas. Terima kasih, pembayaranmu sudah diterima
          {inv.dibayarPada ? ` pada ${formatTanggal(inv.dibayarPada)}` : ""}.
        </p>
      ) : inv.status === "perlu_review" ? (
        <p className="flex items-start gap-2 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">
          <Eye className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Pembayaranmu sedang diperiksa pemilik kos karena nominalnya belum cocok dengan
          tagihan.
        </p>
      ) : (
        <section aria-labelledby="bayar-judul" className="flex flex-col gap-3 rounded-2xl border bg-card p-5">
          <h2 id="bayar-judul" className="font-semibold">
            Cara bayar
          </h2>
          <p className="text-sm text-muted-foreground">
            Pembayaran online lewat QRIS dan virtual account segera tersedia di halaman ini.
            Sementara itu, hubungi pemilik kos untuk membayar.
          </p>
          <Button asChild size="lg" className="h-11 text-base">
            <a href={linkWa} target="_blank" rel="noopener noreferrer">
              <MessageCircle data-icon="inline-start" />
              Hubungi pemilik kos
            </a>
          </Button>
        </section>
      )}

      <p className="mt-auto pt-4 text-center text-xs text-muted-foreground">
        Tagihan ini dikirim lewat Kostera. Status Lunas hanya berubah saat pembayaran terverifikasi.
      </p>
    </main>
  );
}
