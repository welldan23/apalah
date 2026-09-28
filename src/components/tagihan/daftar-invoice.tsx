"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

import { parseStatusFilter, type StatusFilter } from "@/components/dashboard/status-filter";
import { InvoiceStatusBadge } from "@/components/status-badge";
import { StatusFilterChips } from "@/components/status-filter-chips";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPeriode, formatRupiah, formatTanggalPendek } from "@/lib/format";
import {
  PILIHAN_URUT,
  keteranganWaktu,
  parseUrutInvoice,
  urutkanInvoice,
} from "@/lib/invoice";
import type { InvoiceRow } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Daftar Invoice satu periode: cari nama penghuni/kamar, saring per status, dan urutkan (disimpan di URL). */
export function DaftarInvoice({
  invoices,
  hariIni,
  periode,
}: {
  invoices: InvoiceRow[];
  hariIni: string;
  periode: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filter = parseStatusFilter(searchParams.get("status"));
  const cari = searchParams.get("q") ?? "";
  const urut = parseUrutInvoice(searchParams.get("urut"));

  function setParam(nama: "status" | "q" | "urut", nilai: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (nilai) params.set(nama, nilai);
    else params.delete(nama);
    const query = params.toString();
    // replaceState tersinkron dengan useSearchParams tanpa memuat ulang data server.
    window.history.replaceState(null, "", `${pathname}${query ? `?${query}` : ""}`);
  }

  const kataKunci = cari.trim().toLowerCase();
  const hasilCari = kataKunci
    ? invoices.filter(
        (inv) =>
          inv.namaPenghuni.toLowerCase().includes(kataKunci) ||
          inv.nomorKamar.toLowerCase().includes(kataKunci),
      )
    : invoices;
  const tersaring = urutkanInvoice(
    filter === "semua" ? hasilCari : hasilCari.filter((inv) => inv.status === filter),
    urut,
  );
  const totalTersaring = tersaring.reduce((jumlah, inv) => jumlah + inv.nominal, 0);

  if (invoices.length === 0) {
    return (
      <Card className="items-center gap-2 px-4 py-12 text-center shadow-none">
        <p className="font-medium">Belum ada tagihan untuk {formatPeriode(periode)}</p>
        <p className="text-sm text-muted-foreground">
          Buat tagihan lewat tombol Buat tagihan di Dashboard.
        </p>
        <Button asChild variant="outline" size="lg" className="mt-2 h-10">
          <Link href="/dashboard">Ke Dashboard</Link>
        </Button>
      </Card>
    );
  }

  return (
    <Card className="gap-0 py-0 shadow-none">
      <div className="flex flex-col gap-3 border-b p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              aria-label="Cari nama penghuni atau nomor kamar"
              placeholder="Cari penghuni atau kamar"
              className="h-11 bg-card pl-9 text-base sm:h-10 sm:text-sm"
              value={cari}
              onChange={(e) => setParam("q", e.target.value)}
            />
          </div>
          <select
            aria-label="Urutkan tagihan"
            className="h-11 w-full rounded-lg border border-input bg-card px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-10 sm:w-56 sm:text-sm"
            value={urut}
            onChange={(e) => setParam("urut", e.target.value === "prioritas" ? null : e.target.value)}
          >
            {PILIHAN_URUT.map(({ value, label }) => (
              <option key={value} value={value}>
                Urut: {label}
              </option>
            ))}
          </select>
        </div>
        <StatusFilterChips
          invoices={hasilCari}
          filter={filter}
          onChange={(f: StatusFilter) => setParam("status", f === "semua" ? null : f)}
        />
      </div>

      {tersaring.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Tidak ada tagihan yang cocok
            {kataKunci ? ` dengan “${cari.trim()}”` : ""}.
          </p>
          <Button
            variant="outline"
            size="lg"
            className="h-10"
            onClick={() => {
              setParam("q", null);
              setParam("status", null);
            }}
          >
            <X data-icon="inline-start" />
            Hapus pencarian &amp; filter
          </Button>
        </div>
      ) : (
        <>
          {/* Mobile: daftar kartu ringkas */}
          <ul className="divide-y md:hidden">
            {tersaring.map((inv) => {
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
                      {inv.status === "lunas"
                        ? waktu.teks
                        : `${formatTanggalPendek(inv.jatuhTempo)} · ${waktu.teks}`}
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
                <TableHead>Diterbitkan</TableHead>
                <TableHead>Jatuh tempo</TableHead>
                <TableHead className="text-right">Nominal</TableHead>
                <TableHead className="pr-4">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tersaring.map((inv) => {
                const waktu = keteranganWaktu(inv, hariIni);
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="pl-4 font-medium">{inv.namaPenghuni}</TableCell>
                    <TableCell className="tabular-nums">{inv.nomorKamar}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatTanggalPendek(inv.diterbitkanPada)}
                    </TableCell>
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

          <p className="border-t px-4 py-3 text-xs text-muted-foreground">
            Menampilkan {tersaring.length} dari {invoices.length} tagihan · total{" "}
            <span className="font-medium text-foreground tabular-nums">
              {formatRupiah(totalTersaring)}
            </span>
          </p>
        </>
      )}
    </Card>
  );
}
