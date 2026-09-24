"use client";

import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { parseStatusFilter, type StatusFilter } from "@/components/dashboard/status-filter";
import { DetailTagihan } from "@/components/pembayaran/detail-tagihan";
import { ActionSheet } from "@/components/quick-actions/action-sheet";
import { InvoiceStatusBadge, TONE_DOT, toneStatusInvoice } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TagihanPembayaran } from "@/lib/data/pembayaran";
import { formatPeriode, formatRupiah, formatRupiahSingkat, formatWaktu } from "@/lib/format";
import type { InvoiceStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const RINGKASAN: { status: InvoiceStatus; label: string }[] = [
  { status: "lunas", label: "Lunas" },
  { status: "menunggu", label: "Menunggu" },
  { status: "jatuh_tempo", label: "Jatuh tempo" },
  { status: "perlu_review", label: "Perlu review" },
];

/** "Kurang Rp50.000" / "Lebih Rp50.000" bila uang diterima tidak sama dengan tagihan. */
function selisih(t: TagihanPembayaran) {
  if (t.dibayar === 0 || t.dibayar === t.nominal) return null;
  const beda = t.dibayar - t.nominal;
  return `${beda < 0 ? "Kurang" : "Lebih"} ${formatRupiah(Math.abs(beda))}`;
}

function InfoBayar({ t }: { t: TagihanPembayaran }) {
  if (!t.pembayaranTerakhir) return <span className="text-muted-foreground">Belum ada pembayaran</span>;
  const beda = selisih(t);
  return (
    <>
      <span className="font-medium tabular-nums">{formatRupiah(t.dibayar)}</span>
      <span className="block text-xs text-muted-foreground">
        {t.pembayaranTerakhir.metode}
        {t.pembayaranTerakhir.waktu && ` · ${formatWaktu(t.pembayaranTerakhir.waktu)}`}
      </span>
      {beda && <span className="block text-xs font-medium text-warning">{beda}</span>}
    </>
  );
}

/** Label periode kecil untuk tagihan dari bulan lain (mis. di filter Perlu review). */
function LabelPeriode({ t, periode }: { t: TagihanPembayaran; periode: string }) {
  if (t.periode === periode) return null;
  return (
    <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[0.7rem] font-normal text-muted-foreground">
      {formatPeriode(t.periode)}
    </span>
  );
}

/**
 * Pemantauan pembayaran: ringkasan per status (sekaligus filter) + daftar tagihan & uang masuk.
 * Perlu review mencakup semua periode supaya tidak ada pembayaran bermasalah yang terlewat.
 */
export function DaftarPembayaran({
  tagihan,
  tagihanPerluReview,
  periode,
  hariIni,
}: {
  /** Tagihan periode yang sedang dilihat. */
  tagihan: TagihanPembayaran[];
  /** Tagihan Perlu review dari semua periode. */
  tagihanPerluReview: TagihanPembayaran[];
  periode: string;
  hariIni: string;
}) {
  const [dipilih, setDipilih] = useState<TagihanPembayaran | null>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filter = parseStatusFilter(searchParams.get("status"));

  function gantiFilter(f: StatusFilter) {
    const params = new URLSearchParams(searchParams.toString());
    if (f === "semua") params.delete("status");
    else params.set("status", f);
    const query = params.toString();
    window.history.replaceState(null, "", `${pathname}${query ? `?${query}` : ""}`);
  }

  const sumberUntuk = (status: InvoiceStatus) =>
    status === "perlu_review" ? tagihanPerluReview : tagihan.filter((t) => t.status === status);
  const tersaring = filter === "semua" ? tagihan : sumberUntuk(filter);

  return (
    <>
      <div role="group" aria-label="Saring per status" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {RINGKASAN.map(({ status, label }) => {
          const baris = sumberUntuk(status);
          const nominal = baris.reduce((total, t) => total + t.nominal, 0);
          const aktif = filter === status;
          const perhatian = status === "perlu_review" && baris.length > 0;
          return (
            <button
              key={status}
              type="button"
              aria-pressed={aktif}
              onClick={() => gantiFilter(aktif ? "semua" : status)}
              className={cn(
                "flex flex-col gap-1 rounded-xl border bg-card p-3.5 text-left transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                aktif && "border-primary/60 ring-1 ring-primary/40",
                perhatian && !aktif && "border-warning/50 bg-warning-soft/60",
              )}
            >
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <span aria-hidden="true" className={cn("size-2 rounded-full", TONE_DOT[toneStatusInvoice(status)])} />
                {label}
              </span>
              <span className="text-2xl font-semibold tabular-nums">{baris.length}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {formatRupiahSingkat(nominal)}
                {status === "perlu_review" && " · semua periode"}
              </span>
            </button>
          );
        })}
      </div>

      <Card className="gap-0 py-0 shadow-none">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <h2 className="font-semibold">
            {filter === "semua"
              ? "Semua tagihan"
              : RINGKASAN.find((r) => r.status === filter)?.label ?? "Tagihan"}
            <span className="ml-1.5 text-sm font-normal text-muted-foreground">· {tersaring.length}</span>
          </h2>
          {filter !== "semua" && (
            <button
              type="button"
              onClick={() => gantiFilter("semua")}
              className="min-h-11 text-sm font-medium text-primary hover:underline"
            >
              Tampilkan semua
            </button>
          )}
        </div>

        {tersaring.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">
            {tagihan.length === 0
              ? "Belum ada tagihan di periode ini."
              : "Tidak ada tagihan dengan status ini."}
          </p>
        ) : (
          <>
            {/* Mobile: kartu */}
            <ul className="divide-y md:hidden">
              {tersaring.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    aria-label={`Detail tagihan ${t.nomorKamar} ${t.namaPenghuni}`}
                    onClick={() => setDipilih(t)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left outline-none hover:bg-muted/60 focus-visible:bg-muted/60"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-xs font-semibold tabular-nums">
                      {t.nomorKamar}
                    </span>
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="block truncate font-medium">
                        {t.namaPenghuni}
                        <LabelPeriode t={t} periode={periode} />
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        Tagihan <span className="tabular-nums">{formatRupiah(t.nominal)}</span>
                      </span>
                      <span className="mt-1 block">
                        <InfoBayar t={t} />
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <InvoiceStatusBadge status={t.status} />
                      <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            {/* Tablet & desktop: tabel */}
            <Table className="hidden md:table">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Penghuni</TableHead>
                  <TableHead>Kamar</TableHead>
                  <TableHead className="text-right">Tagihan</TableHead>
                  <TableHead>Pembayaran diterima</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-4">
                    <span className="sr-only">Detail</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tersaring.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="pl-4 font-medium">
                      {t.namaPenghuni}
                      <LabelPeriode t={t} periode={periode} />
                    </TableCell>
                    <TableCell className="tabular-nums">{t.nomorKamar}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatRupiah(t.nominal)}</TableCell>
                    <TableCell>
                      <InfoBayar t={t} />
                    </TableCell>
                    <TableCell>
                      <InvoiceStatusBadge status={t.status} />
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-haspopup="dialog"
                        aria-label={`Detail tagihan ${t.nomorKamar} ${t.namaPenghuni}`}
                        onClick={() => setDipilih(t)}
                      >
                        Detail
                        <ChevronRight data-icon="inline-end" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </Card>

      <ActionSheet
        open={dipilih !== null}
        onOpenChange={(buka) => !buka && setDipilih(null)}
        title="Detail tagihan"
        description="Rincian tagihan dan pembayaran yang diterima dari gateway."
      >
        {dipilih && <DetailTagihan tagihan={dipilih} hariIni={hariIni} />}
      </ActionSheet>
    </>
  );
}
