"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

import { StatusKirim } from "@/components/reminder/riwayat-reminder";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { RiwayatReminder } from "@/lib/data/reminder";
import { formatPeriode, formatRupiah, formatWaktu } from "@/lib/format";
import {
  jenisDiRiwayat,
  labelJenisReminder,
  parseStatusRiwayat,
  periodeDiRiwayat,
  saringRiwayatReminder,
  STATUS_RIWAYAT,
  type StatusRiwayat,
} from "@/lib/reminder";
import { cn } from "@/lib/utils";

const LABEL_STATUS: Record<StatusRiwayat, string> = { semua: "Semua", terkirim: "Terkirim", gagal: "Gagal" };

type ParamFilter = "status" | "jenis" | "tagihan" | "q";
const TANPA_FILTER: Record<ParamFilter, null> = { status: null, jenis: null, tagihan: null, q: null };

const kelasSelect =
  "h-11 w-full min-w-0 rounded-lg border border-input bg-card px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-10 sm:w-44 sm:text-sm";

/** Riwayat pengingat satu bulan: cari nama/kamar, saring status, jenis & bulan tagihan (disimpan di URL). */
export function TabelRiwayatReminder({ riwayat, periode }: { riwayat: RiwayatReminder[]; periode: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const status = parseStatusRiwayat(searchParams.get("status"));
  const jenis = searchParams.get("jenis") ?? "";
  const tagihan = searchParams.get("tagihan") ?? "";
  const cari = searchParams.get("q") ?? "";

  function setParams(perubahan: Partial<Record<ParamFilter, string | null>>) {
    const params = new URLSearchParams(window.location.search);
    for (const [nama, nilai] of Object.entries(perubahan)) {
      if (nilai) params.set(nama, nilai);
      else params.delete(nama);
    }
    const query = params.toString();
    // replaceState tersinkron dengan useSearchParams tanpa memuat ulang data server.
    window.history.replaceState(null, "", `${pathname}${query ? `?${query}` : ""}`);
  }

  const pilihanJenis = jenisDiRiwayat(riwayat);
  const pilihanTagihan = periodeDiRiwayat(riwayat);
  // Pilihan bulan tagihan baru berguna bila pengingat bulan ini menyangkut lebih dari satu tagihan.
  const tampilTagihan = pilihanTagihan.length > 1 || tagihan !== "";
  // Jumlah per status mengikuti filter lain yang sedang dipakai.
  const tanpaStatus = saringRiwayatReminder(riwayat, { status: "semua", jenis, tagihan, cari });
  const tersaring = tanpaStatus.filter((r) => status === "semua" || r.status === status);
  const jumlah = (s: StatusRiwayat) => (s === "semua" ? tanpaStatus.length : tanpaStatus.filter((r) => r.status === s).length);
  const adaFilter = status !== "semua" || jenis !== "" || tagihan !== "" || cari.trim() !== "";

  if (riwayat.length === 0) {
    return (
      <Card className="items-center gap-2 px-4 py-12 text-center shadow-none">
        <p className="font-medium">Belum ada pengingat terkirim di {formatPeriode(periode)}</p>
        <p className="text-sm text-muted-foreground">Pengingat otomatis dan manual akan tercatat di sini.</p>
        <Button asChild variant="outline" size="lg" className="mt-2 h-10">
          <Link href="/reminder/kirim">Kirim reminder</Link>
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
              onChange={(e) => setParams({ q: e.target.value })}
            />
          </div>
          <div className={cn("grid gap-2 sm:flex", tampilTagihan ? "grid-cols-2" : "grid-cols-1")}>
            <select
              aria-label="Saring jenis pengingat"
              className={kelasSelect}
              value={jenis}
              onChange={(e) => setParams({ jenis: e.target.value })}
            >
              <option value="">Semua jenis</option>
              {pilihanJenis.map((j) => (
                <option key={j} value={j}>
                  {labelJenisReminder(j)}
                </option>
              ))}
            </select>
            {tampilTagihan && (
              <select
                aria-label="Saring bulan tagihan"
                className={kelasSelect}
                value={tagihan}
                onChange={(e) => setParams({ tagihan: e.target.value })}
              >
                <option value="">Semua tagihan</option>
                {/* Nilai dari URL yang tidak ada di data tetap tampil supaya bisa dilepas. */}
                {(!tagihan || pilihanTagihan.includes(tagihan) ? pilihanTagihan : [tagihan, ...pilihanTagihan]).map((p) => (
                  <option key={p} value={p}>
                    {formatPeriode(p)}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Saring hasil kirim" className="flex gap-1.5">
            {STATUS_RIWAYAT.map((s) => {
              const aktif = status === s;
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={aktif}
                  onClick={() => setParams({ status: s === "semua" ? null : s })}
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-8",
                    aktif ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  {LABEL_STATUS[s]}
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-xs tabular-nums",
                      aktif ? "bg-primary-foreground/15" : "bg-card",
                      !aktif && s === "gagal" && jumlah(s) > 0 && "text-danger",
                    )}
                  >
                    {jumlah(s)}
                  </span>
                </button>
              );
            })}
          </div>
          {adaFilter && (
            <Button variant="ghost" size="sm" className="ml-auto h-9 sm:h-8" onClick={() => setParams(TANPA_FILTER)}>
              <X data-icon="inline-start" />
              Reset
            </Button>
          )}
        </div>
      </div>

      {tersaring.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Tidak ada pengingat yang cocok{cari.trim() ? ` dengan “${cari.trim()}”` : ""}.
          </p>
          {adaFilter && (
            <Button
              variant="outline"
              size="lg"
              className="h-10"
              onClick={() => setParams(TANPA_FILTER)}
            >
              <X data-icon="inline-start" />
              Hapus pencarian &amp; filter
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Mobile: daftar kartu ringkas */}
          <ul className="divide-y md:hidden">
            {tersaring.map((r) => (
              <li key={r.id} className="flex items-start gap-3 px-4 py-3 text-sm">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-xs font-semibold tabular-nums">
                  {r.nomorKamar}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.namaPenghuni}</p>
                  <p className="text-xs text-muted-foreground">
                    {labelJenisReminder(r.jenis)} · {formatWaktu(r.terkirimPada)}
                  </p>
                  <p className="text-xs text-muted-foreground">Tagihan {formatPeriode(r.periode)}</p>
                  {r.galat && <p className="mt-0.5 text-xs text-danger">{r.galat}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="font-semibold tabular-nums">{formatRupiah(r.nominal)}</span>
                  <StatusKirim status={r.status} />
                </div>
              </li>
            ))}
          </ul>

          {/* Tablet & desktop: tabel */}
          <Table className="hidden md:table">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Waktu kirim</TableHead>
                <TableHead>Penghuni</TableHead>
                <TableHead>Kamar</TableHead>
                <TableHead>Jenis</TableHead>
                <TableHead>Tagihan</TableHead>
                <TableHead className="text-right">Nominal</TableHead>
                <TableHead className="pr-4">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tersaring.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="pl-4 text-muted-foreground tabular-nums">{formatWaktu(r.terkirimPada)}</TableCell>
                  <TableCell className="font-medium">{r.namaPenghuni}</TableCell>
                  <TableCell className="tabular-nums">{r.nomorKamar}</TableCell>
                  <TableCell>{labelJenisReminder(r.jenis)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatPeriode(r.periode)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatRupiah(r.nominal)}</TableCell>
                  <TableCell className="pr-4">
                    <StatusKirim status={r.status} />
                    {r.galat && (
                      <span title={r.galat} className="mt-1 block max-w-48 truncate text-xs text-danger">
                        {r.galat}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <p className="border-t px-4 py-3 text-xs text-muted-foreground">
            Menampilkan {tersaring.length} dari {riwayat.length} pengingat
          </p>
        </>
      )}
    </Card>
  );
}
