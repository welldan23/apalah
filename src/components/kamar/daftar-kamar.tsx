"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { LayoutGrid, List, Search } from "lucide-react";

import { KartuKamar } from "@/components/kamar/kartu-kamar";
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
import { formatRupiah, formatRupiahSingkat, formatTanggal } from "@/lib/format";
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

type Tampilan = "kartu" | "daftar";

/** Kartu kamar dikelompokkan per tipe, lengkap dengan harga & hunian tiap tipe. */
function GridKamar({ kamar }: { kamar: KamarPenghuni[] }) {
  const perTipe = new Map<string, KamarPenghuni[]>();
  for (const k of kamar) perTipe.set(k.tipe, [...(perTipe.get(k.tipe) ?? []), k]);

  return (
    <div className="flex flex-col gap-6 p-4">
      {[...perTipe.entries()].map(([tipe, daftar]) => (
        <section key={tipe} aria-label={`Kamar tipe ${tipe}`}>
          <h3 className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
            <span className="font-semibold">
              {tipe}
              <span className="font-normal text-muted-foreground">
                {" "}
                · {formatRupiahSingkat(daftar[0].hargaSewa)}/bln
              </span>
            </span>
            <span className="text-xs text-muted-foreground">
              {daftar.filter((k) => k.status === "terisi").length}/{daftar.length} terisi
            </span>
          </h3>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {daftar.map((k) => (
              <li key={k.id}>
                <KartuKamar kamar={k} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

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
  const tampilan: Tampilan = searchParams.get("tampilan") === "daftar" ? "daftar" : "kartu";

  function setParam(nama: "status" | "q" | "tampilan", nilai: string | null) {
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
        <div className="flex items-center justify-between gap-2">
          <div
            role="group"
            aria-label="Saring status kamar"
            className="flex min-w-0 gap-1.5 overflow-x-auto [scrollbar-width:none]"
          >
            {FILTER.map(({ value, label }) => {
              const aktif = filter === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={aktif}
                  onClick={() => setParam("status", value === "semua" ? null : value)}
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-8",
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
          <div role="group" aria-label="Tampilan" className="flex shrink-0 rounded-lg bg-muted p-0.5">
            {(
              [
                ["kartu", "Kartu", LayoutGrid],
                ["daftar", "Daftar", List],
              ] as const
            ).map(([nilai, label, Ikon]) => (
              <button
                key={nilai}
                type="button"
                aria-pressed={tampilan === nilai}
                aria-label={`Tampilan ${label.toLowerCase()}`}
                title={label}
                onClick={() => setParam("tampilan", nilai === "kartu" ? null : nilai)}
                className={cn(
                  "grid size-9 place-items-center rounded-md transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:size-8",
                  tampilan === nilai ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Ikon className="size-4" aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {tersaring.length === 0 ? (
        <p className="px-4 py-12 text-center text-sm text-muted-foreground">
          Tidak ada kamar yang cocok{kataKunci ? ` dengan “${cari.trim()}”` : ""}.
        </p>
      ) : tampilan === "kartu" ? (
        <GridKamar kamar={tersaring} />
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
