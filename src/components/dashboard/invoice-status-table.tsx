"use client";

import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowRight, ChevronDown } from "lucide-react";

import {
  STATUS_FILTER,
  parseStatusFilter,
  type StatusFilter,
} from "@/components/dashboard/status-filter";
import { InvoiceStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatPeriode,
  formatRupiah,
  formatTanggalPendek,
  selisihHari,
} from "@/lib/format";
import type { InvoiceRow } from "@/lib/types";
import { cn } from "@/lib/utils";

const BARIS_AWAL = 8;

// Filter yang selalu tampil walau jumlahnya nol (status utama di PRD).
const FILTER_TETAP = new Set<StatusFilter>(["semua", "jatuh_tempo", "menunggu", "lunas"]);

/** Keterangan waktu: kapan dibayar, atau seberapa dekat/lewat jatuh tempo. */
function keteranganWaktu(inv: InvoiceRow, hariIni: string) {
  if (inv.status === "lunas" && inv.dibayarPada) {
    return { teks: `Dibayar ${formatTanggalPendek(inv.dibayarPada)}`, telat: false };
  }
  const sisa = selisihHari(hariIni, inv.jatuhTempo);
  if (sisa < 0) return { teks: `Lewat ${-sisa} hari`, telat: true };
  if (sisa === 0) return { teks: "Jatuh tempo hari ini", telat: false };
  return { teks: `${sisa} hari lagi`, telat: false };
}

/** Tabel Status Bayar: invoice periode berjalan, bisa disaring per status. */
export function InvoiceStatusTable({
  invoices,
  periode,
  hariIni,
}: {
  invoices: InvoiceRow[];
  periode: string;
  hariIni: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filter = parseStatusFilter(searchParams.get("status"));
  // Daftar lengkap hanya berlaku untuk filter yang sedang dibuka.
  const [diperluasUntuk, setDiperluasUntuk] = useState<StatusFilter | null>(null);
  const semuaBaris = diperluasUntuk === filter;

  const jumlah = (f: StatusFilter) =>
    f === "semua" ? invoices.length : invoices.filter((inv) => inv.status === f).length;
  const pilihan = STATUS_FILTER.filter(
    (f) => FILTER_TETAP.has(f.value) || f.value === filter || jumlah(f.value) > 0,
  );

  const tersaring =
    filter === "semua" ? invoices : invoices.filter((inv) => inv.status === filter);
  const baris = semuaBaris ? tersaring : tersaring.slice(0, BARIS_AWAL);
  const labelFilter = STATUS_FILTER.find((f) => f.value === filter)?.label.toLowerCase();

  function gantiFilter(f: StatusFilter) {
    const params = new URLSearchParams(searchParams.toString());
    if (f === "semua") params.delete("status");
    else params.set("status", f);
    const query = params.toString();
    // replaceState tersinkron dengan useSearchParams tanpa memuat ulang data server.
    window.history.replaceState(null, "", `${pathname}${query ? `?${query}` : ""}`);
  }

  return (
    <Card id="status-bayar" className="gap-0 pb-0 shadow-none">
      <CardHeader>
        <CardTitle>Status bayar</CardTitle>
        <CardDescription>
          {invoices.length} tagihan · {formatPeriode(periode)}
        </CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" disabled title="Daftar invoice segera hadir">
            Lihat semua
            <ArrowRight data-icon="inline-end" />
          </Button>
        </CardAction>
      </CardHeader>

      <div
        role="group"
        aria-label="Saring status tagihan"
        className="flex gap-1.5 overflow-x-auto border-b px-4 pt-3 pb-3 [scrollbar-width:none]"
      >
        {pilihan.map(({ value, label }) => {
          const aktif = filter === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={aktif}
              onClick={() => gantiFilter(value)}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium sm:h-8 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                aktif
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs tabular-nums",
                  aktif ? "bg-primary-foreground/15" : "bg-card",
                  !aktif && value === "jatuh_tempo" && jumlah(value) > 0 && "text-danger",
                )}
              >
                {jumlah(value)}
              </span>
            </button>
          );
        })}
      </div>

      <CardContent className="px-0">
        {baris.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            Tidak ada tagihan {labelFilter} di periode ini.
          </p>
        ) : (
          <>
            {/* Mobile: daftar kartu ringkas */}
            <ul className="divide-y md:hidden">
              {baris.map((inv) => {
                const waktu = keteranganWaktu(inv, hariIni);
                return (
                  <li key={inv.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-xs font-semibold tabular-nums">
                      {inv.nomorKamar}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{inv.namaPenghuni}</p>
                      <p
                        className={cn(
                          "truncate text-xs text-muted-foreground",
                          waktu.telat && "text-danger",
                        )}
                      >
                        {waktu.teks}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-sm font-semibold tabular-nums">
                        {formatRupiah(inv.nominal)}
                      </span>
                      <InvoiceStatusBadge status={inv.status} />
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Tablet & desktop: tabel */}
            <Table className="hidden md:table">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Penghuni</TableHead>
                  <TableHead>Kamar</TableHead>
                  <TableHead>Jatuh tempo</TableHead>
                  <TableHead className="text-right">Nominal</TableHead>
                  <TableHead className="pr-4">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {baris.map((inv) => {
                  const waktu = keteranganWaktu(inv, hariIni);
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="pl-4 font-medium">{inv.namaPenghuni}</TableCell>
                      <TableCell className="tabular-nums">{inv.nomorKamar}</TableCell>
                      <TableCell>
                        <span className="block">{formatTanggalPendek(inv.jatuhTempo)}</span>
                        <span
                          className={cn(
                            "block text-xs text-muted-foreground",
                            waktu.telat && "text-danger",
                          )}
                        >
                          {waktu.teks}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatRupiah(inv.nominal)}
                      </TableCell>
                      <TableCell className="pr-4">
                        <InvoiceStatusBadge status={inv.status} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>

      {tersaring.length > BARIS_AWAL && (
        <CardFooter className="justify-between gap-3 bg-transparent py-2 text-xs text-muted-foreground">
          <span>
            Menampilkan {baris.length} dari {tersaring.length} tagihan
          </span>
          <Button
            variant="ghost"
            className="h-9 sm:h-7"
            size="sm"
            aria-expanded={semuaBaris}
            onClick={() => setDiperluasUntuk(semuaBaris ? null : filter)}
          >
            {semuaBaris ? "Tampilkan lebih sedikit" : "Tampilkan semua"}
            <ChevronDown
              data-icon="inline-end"
              className={cn("transition-transform", semuaBaris && "rotate-180")}
            />
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
