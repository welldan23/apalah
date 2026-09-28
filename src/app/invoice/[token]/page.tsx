import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleCheck, Clock, Eye, MessageCircle, Wallet, Wrench } from "lucide-react";

import { KosteraLogo } from "@/components/app-shell/kostera-logo";
import { InvoiceStatusBadge, StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { getDb } from "@/db";
import { getInvoicePublik, type PembayaranPublik } from "@/lib/data/invoice-publik";
import { formatPeriode, formatRupiah, formatTanggal, formatWaktu } from "@/lib/format";
import { keteranganWaktu } from "@/lib/invoice";
import { cn } from "@/lib/utils";
import { hariIniWib } from "@/lib/waktu";

const STATUS_BAYAR = {
  valid: { label: "Diterima", tone: "success", icon: CircleCheck },
  tidak_cocok: { label: "Diperiksa", tone: "warning", icon: Eye },
  pending: { label: "Diproses", tone: "neutral", icon: Clock },
} as const satisfies Record<PembayaranPublik["status"], unknown>;

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
  const lebihBayar = inv.sudahDiterima - inv.nominal;
  const pesanWa = `Halo, saya ${inv.namaPenghuni} (kamar ${inv.nomorKamar}). Saya mau konfirmasi tagihan ${inv.nomorInvoice} sebesar ${formatRupiah(inv.nominal)}.`;
  const linkWa = `https://wa.me/${inv.nomorWaPemilik}?text=${encodeURIComponent(pesanWa)}`;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-6 sm:py-10">
      <header className="flex items-center justify-between gap-3">
        <KosteraLogo />
        <span className="text-sm text-muted-foreground">Invoice sewa</span>
      </header>

      {/* Tampil seperti nota: nomor & kode pakai huruf mono, garis putus-putus, total bergaris ganda,
          dan cap LUNAS begitu tagihan dibayar. */}
      <section aria-labelledby="invoice-judul" className="flex flex-col gap-5 rounded-md border bg-card p-5 sm:p-6">
        <p className="-mt-1 flex items-center justify-between gap-3 border-b border-dashed pb-3 font-mono text-xs text-muted-foreground uppercase">
          <span>Invoice sewa</span>
          <span>{inv.nomorInvoice}</span>
        </p>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 id="invoice-judul" className="text-xl font-semibold tracking-[-0.01em]">
              {inv.namaKos}
            </h1>
            {inv.alamatKos && <p className="text-sm text-muted-foreground">{inv.alamatKos}</p>}
          </div>
          {inv.status !== "lunas" && <InvoiceStatusBadge status={inv.status} className="shrink-0" />}
        </div>
        <div className="relative">
          {inv.status === "lunas" && (
            <p
              aria-hidden="true"
              className="pointer-events-none absolute top-1 right-0 -rotate-12 rounded-sm border-[3px] border-success/80 px-3 py-1 text-center font-mono text-xl leading-tight font-semibold tracking-[0.2em] text-success/80 uppercase"
            >
              Lunas
              {inv.dibayarPada && (
                <span className="block text-[0.6rem] tracking-[0.1em]">{formatTanggal(inv.dibayarPada)}</span>
              )}
            </p>
          )}
          <p className="text-sm text-muted-foreground">Total tagihan</p>
          <p className="text-4xl font-semibold tracking-[-0.02em]">{formatRupiah(inv.nominal)}</p>
          <p className={cn("mt-1 text-sm text-muted-foreground", waktu.telat && "text-danger")}>
            {inv.status === "lunas"
              ? waktu.teks
              : `Jatuh tempo ${formatTanggal(inv.jatuhTempo)} · ${waktu.teks}`}
          </p>
          {inv.status !== "lunas" && inv.sudahDiterima > 0 && (
            <p className="mt-2 rounded-md bg-muted px-3 py-2 text-sm">
              Sudah dibayar <span className="font-medium tabular-nums">{formatRupiah(inv.sudahDiterima)}</span>
              {inv.sisa > 0 && (
                <>
                  {" "}
                  · Sisa <span className="font-semibold tabular-nums">{formatRupiah(inv.sisa)}</span>
                </>
              )}
              {lebihBayar > 0 && (
                <>
                  {" "}
                  · Lebih bayar <span className="font-semibold tabular-nums">{formatRupiah(lebihBayar)}</span>
                </>
              )}
            </p>
          )}
        </div>

        <dl className="flex flex-col gap-2 border-y border-dashed py-4 text-sm">
          {(
            [
              ["Penghuni", inv.namaPenghuni],
              ["Kamar", `${inv.nomorKamar} · ${inv.tipeKamar}`],
              ["Periode", formatPeriode(inv.periode)],
              ["Diterbitkan", formatTanggal(inv.diterbitkanPada)],
            ] as const
          ).map(([label, nilai]) => (
            <div key={label} className="flex items-baseline gap-2">
              <dt className="text-muted-foreground">{label}</dt>
              <span aria-hidden="true" className="flex-1 border-b border-dotted border-muted-foreground/40" />
              <dd className="text-right font-medium">{nilai}</dd>
            </div>
          ))}
        </dl>

        <section aria-labelledby="rincian-judul">
          <h2 id="rincian-judul" className="mb-2 text-sm font-medium">
            Rincian
          </h2>
          <ul className="flex flex-col gap-2 text-sm">
            {inv.rincian.map((r, i) => (
              <li key={i} className="flex items-start justify-between gap-4">
                <span>{r.label}</span>
                <span className="font-medium tabular-nums">{formatRupiah(r.nominal)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between gap-4 border-t-[3px] border-double border-foreground pt-3 text-base font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatRupiah(inv.nominal)}</span>
          </div>
        </section>

        {inv.pembayaran.length > 0 && (
          <section aria-labelledby="riwayat-bayar-judul">
            <h2 id="riwayat-bayar-judul" className="mb-2 text-sm font-medium">
              Riwayat pembayaran
            </h2>
            <ul className="divide-y rounded-md border text-sm">
              {inv.pembayaran.map((p, i) => {
                const s = STATUS_BAYAR[p.status];
                return (
                  <li key={i} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="font-medium tabular-nums">{formatRupiah(p.nominal)}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.metode} · {formatWaktu(p.waktu)}
                      </p>
                    </div>
                    <StatusBadge tone={s.tone} icon={s.icon} className="shrink-0">
                      {s.label}
                    </StatusBadge>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </section>

      {inv.status === "lunas" ? (
        <p className="flex items-start gap-2 rounded-md border border-success/30 bg-success-soft px-4 py-3 text-sm text-success">
          <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Lunas. Terima kasih, pembayaranmu sudah diterima
          {inv.dibayarPada ? ` pada ${formatTanggal(inv.dibayarPada)}` : ""}.
        </p>
      ) : inv.status === "perlu_review" ? (
        <div className="flex flex-col gap-3">
          <p className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
            <Eye className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Pembayaranmu sedang diperiksa pemilik kos karena nominalnya belum cocok dengan
            tagihan.
          </p>
          {inv.bisaDibayar && (
            <Button asChild size="lg" className="h-11 text-base">
              <Link href={`/invoice/${token}/bayar`}>
                <Wallet data-icon="inline-start" />
                Bayar sisa {formatRupiah(inv.sisa)}
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <section aria-labelledby="bayar-judul" className="flex flex-col gap-3 rounded-md border bg-card p-5 sm:p-6">
          <h2 id="bayar-judul" className="font-semibold">
            Cara bayar
          </h2>
          {inv.bisaDibayar ? (
            <>
              <p className="text-sm text-muted-foreground">
                Bayar lewat QRIS atau transfer Virtual Account. Status jadi Lunas otomatis begitu
                pembayaran diterima — tidak perlu kirim bukti transfer.
              </p>
              <Button asChild size="lg" className="h-12 text-base">
                <Link href={`/invoice/${token}/bayar`}>
                  <Wallet data-icon="inline-start" />
                  Bayar sekarang
                </Link>
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Tagihan ini masih draf dan belum dikirim pemilik kos, jadi belum bisa dibayar. Tombol
              bayar muncul setelah tagihannya dikirim.
            </p>
          )}
          <Button asChild variant="outline" size="lg" className="h-11">
            <a href={linkWa} target="_blank" rel="noopener noreferrer">
              <MessageCircle data-icon="inline-start" />
              Tanya pemilik kos
            </a>
          </Button>
        </section>
      )}

      <Link
        href={`/invoice/${token}/tiket`}
        className="flex min-h-14 items-center justify-between gap-3 rounded-md border bg-card px-4 py-3 text-sm transition-colors hover:border-foreground/40"
      >
        <span>
          <span className="block font-medium">Ada masalah di kamar?</span>
          <span className="block text-xs text-muted-foreground">Buat tiket keluhan atau permintaan perbaikan</span>
        </span>
        <Wrench className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>

      <p className="mt-auto pt-4 text-center text-xs text-muted-foreground">
        Tagihan ini dikirim lewat Kostera. Status Lunas hanya berubah saat pembayaran terverifikasi.
      </p>
    </main>
  );
}
