"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

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
import type { KamarPenghuni } from "@/lib/data/kamar";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { tampilNomorWa } from "@/lib/nomor-wa";
import { cn } from "@/lib/utils";

type FilterKamar = "semua" | "terisi" | "kosong";

const FILTER: { value: FilterKamar; label: string }[] = [
  { value: "semua", label: "Semua" },
  { value: "terisi", label: "Terisi" },
  { value: "kosong", label: "Kosong" },
];

const parseFilter = (v: string | null): FilterKamar =>
  v === "terisi" || v === "kosong" ? v : "semua";

function StatusKamar({ status }: { status: KamarPenghuni["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full px-2 text-xs font-medium",
        status === "terisi"
          ? "bg-accent text-accent-foreground"
          : "border border-dashed border-warning/60 bg-warning-soft text-warning",
      )}
    >
      {status === "terisi" ? "Terisi" : "Kosong"}
    </span>
  );
}

/** Keterangan sewa: harga penghuni, plus harga kamar bila berbeda. */
function Sewa({ kamar }: { kamar: KamarPenghuni }) {
  const sewa = kamar.penghuni?.hargaSewa ?? kamar.hargaSewa;
  const beda = kamar.penghuni && kamar.penghuni.hargaSewa !== kamar.hargaSewa;
  return (
    <>
      <span className="font-medium tabular-nums">{formatRupiah(sewa)}</span>
      {beda && (
        <span className="block text-xs text-muted-foreground tabular-nums">
          harga kamar {formatRupiah(kamar.hargaSewa)}
        </span>
      )}
    </>
  );
}

/** Daftar kamar & penghuni: saring terisi/kosong dan cari kamar/penghuni (tersimpan di URL). */
export function DaftarKamar({ kamar }: { kamar: KamarPenghuni[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filter = parseFilter(searchParams.get("status"));
  const cari = searchParams.get("q") ?? "";

  function setParam(nama: "status" | "q", nilai: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (nilai) params.set(nama, nilai);
    else params.delete(nama);
    const query = params.toString();
    window.history.replaceState(null, "", `${pathname}${query ? `?${query}` : ""}`);
  }

  const kataKunci = cari.trim().toLowerCase();
  const hasilCari = kataKunci
    ? kamar.filter(
        (k) =>
          k.nomorKamar.toLowerCase().includes(kataKunci) ||
          k.tipe.toLowerCase().includes(kataKunci) ||
          k.penghuni?.nama.toLowerCase().includes(kataKunci),
      )
    : kamar;
  const tersaring = filter === "semua" ? hasilCari : hasilCari.filter((k) => k.status === filter);
  const jumlah = (f: FilterKamar) =>
    f === "semua" ? hasilCari.length : hasilCari.filter((k) => k.status === f).length;

  return (
    <Card className="gap-0 py-0 shadow-none">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label="Cari nomor kamar, tipe, atau nama penghuni"
            placeholder="Cari kamar atau penghuni"
            className="h-11 bg-card pl-9 text-base sm:h-10 sm:text-sm"
            value={cari}
            onChange={(e) => setParam("q", e.target.value)}
          />
        </div>
        <div role="group" aria-label="Saring status kamar" className="flex gap-1.5">
          {FILTER.map(({ value, label }) => {
            const aktif = filter === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={aktif}
                onClick={() => setParam("status", value === "semua" ? null : value)}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-8",
                  aktif ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
                <span className={cn("rounded-full px-1.5 text-xs tabular-nums", aktif ? "bg-primary-foreground/15" : "bg-card")}>
                  {jumlah(value)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {tersaring.length === 0 ? (
        <p className="px-4 py-12 text-center text-sm text-muted-foreground">
          Tidak ada kamar yang cocok{kataKunci ? ` dengan “${cari.trim()}”` : ""}.
        </p>
      ) : (
        <>
          {/* Mobile: kartu */}
          <ul className="divide-y md:hidden">
            {tersaring.map((k) => (
              <li key={k.id} className="flex items-start gap-3 px-4 py-3">
                <span
                  className={cn(
                    "grid size-11 shrink-0 place-items-center rounded-lg text-xs font-semibold tabular-nums",
                    k.status === "terisi" ? "bg-accent text-accent-foreground" : "border border-dashed border-warning/60 bg-warning-soft text-warning",
                  )}
                >
                  {k.nomorKamar}
                </span>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="truncate font-medium">{k.penghuni?.nama ?? "Kamar kosong"}</p>
                  <p className="text-xs text-muted-foreground">
                    {k.tipe}
                    {k.penghuni && ` · masuk ${formatTanggal(k.penghuni.tanggalMasuk)}`}
                  </p>
                </div>
                <div className="shrink-0 text-right text-sm">
                  <Sewa kamar={k} />
                </div>
              </li>
            ))}
          </ul>

          {/* Tablet & desktop: tabel */}
          <Table className="hidden md:table">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Kamar</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Penghuni</TableHead>
                <TableHead>Masuk</TableHead>
                <TableHead className="pr-4 text-right">Sewa/bulan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tersaring.map((k) => (
                <TableRow key={k.id}>
                  <TableCell className="pl-4">
                    <span className="font-medium tabular-nums">{k.nomorKamar}</span>
                    <span className="block text-xs text-muted-foreground">{k.tipe}</span>
                  </TableCell>
                  <TableCell>
                    <StatusKamar status={k.status} />
                  </TableCell>
                  <TableCell>
                    {k.penghuni ? (
                      <>
                        <span className="font-medium">{k.penghuni.nama}</span>
                        <span className="block text-xs text-muted-foreground tabular-nums">
                          {tampilNomorWa(k.penghuni.nomorWa)}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {k.penghuni ? formatTanggal(k.penghuni.tanggalMasuk) : "—"}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <Sewa kamar={k} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </Card>
  );
}
