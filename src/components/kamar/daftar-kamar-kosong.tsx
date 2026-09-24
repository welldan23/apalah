"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { UserPlus } from "lucide-react";

import { SheetTambahPenghuni } from "@/components/kamar/tambah-penghuni";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { KamarKosong } from "@/lib/data/kamar";
import { formatRupiah, formatRupiahSingkat, formatTanggal } from "@/lib/format";
import { hariKosong, parseUrutKosong, PILIHAN_URUT_KOSONG, saringKamarKosong } from "@/lib/kamar-kosong";
import { cn } from "@/lib/utils";

/** Kosong selama ini (hari) atau lebih ditandai supaya segera ditawarkan. */
const KOSONG_LAMA = 30;

function KartuKamarKosong({
  kamar: k,
  hariIni,
  onIsi,
}: {
  kamar: KamarKosong;
  hariIni: string;
  onIsi: () => void;
}) {
  const hari = hariKosong(k.kosongSejak, hariIni);

  return (
    <article
      aria-label={`Kamar ${k.nomorKamar}, ${k.tipe}`}
      className="flex h-full items-center gap-3 rounded-xl border border-dashed border-warning/60 bg-warning-soft/40 p-3 sm:flex-col sm:items-stretch"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-lg font-semibold tabular-nums">{k.nomorKamar}</span>
          <span className="text-sm">
            <span className="font-medium tabular-nums">{formatRupiahSingkat(k.hargaSewa)}</span>
            <span className="text-muted-foreground">/bln</span>
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{k.tipe}</p>
        {hari === undefined ? (
          <p className="mt-1.5 text-xs text-muted-foreground">Belum ada riwayat penghuni</p>
        ) : (
          <>
            <p className={cn("mt-1.5 text-sm font-medium", hari >= KOSONG_LAMA && "text-warning")}>
              {hari === 0 ? "Kosong sejak hari ini" : `Kosong ${hari} hari`}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {k.penghuniTerakhir} keluar {formatTanggal(k.kosongSejak!)}
            </p>
          </>
        )}
        {k.catatan && <p className="mt-1 text-xs text-muted-foreground italic">{k.catatan}</p>}
      </div>
      <Button
        variant="outline"
        size="sm"
        className="h-11 shrink-0 bg-card sm:h-9"
        aria-haspopup="dialog"
        aria-label={`Isi kamar ${k.nomorKamar}`}
        onClick={onIsi}
      >
        <UserPlus data-icon="inline-start" />
        Isi kamar
      </Button>
    </article>
  );
}

/** Kamar kosong yang siap ditawarkan: saring per tipe & urutkan (tersimpan di URL). */
export function DaftarKamarKosong({ kamar, hariIni }: { kamar: KamarKosong[]; hariIni: string }) {
  const [isiKamar, setIsiKamar] = useState<string | null>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const daftarTipe = [...new Set(kamar.map((k) => k.tipe))];
  const tipeParam = searchParams.get("tipe");
  const tipe = tipeParam && daftarTipe.includes(tipeParam) ? tipeParam : null;
  const urut = parseUrutKosong(searchParams.get("urut"));
  const tersaring = saringKamarKosong(kamar, { tipe, urut });
  const potensi = tersaring.reduce((total, k) => total + k.hargaSewa, 0);

  function setParam(nama: "tipe" | "urut", nilai: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (nilai) params.set(nama, nilai);
    else params.delete(nama);
    const query = params.toString();
    window.history.replaceState(null, "", `${pathname}${query ? `?${query}` : ""}`);
  }

  if (kamar.length === 0) {
    return (
      <Card className="items-center gap-2 px-4 py-12 text-center shadow-none">
        <p className="font-medium">Semua kamar sudah terisi</p>
        <p className="text-sm text-muted-foreground">Kamar yang ditinggal penghuni akan muncul di sini.</p>
        <Button asChild variant="outline" size="lg" className="mt-2 h-10">
          <Link href="/kamar">Lihat semua kamar</Link>
        </Button>
      </Card>
    );
  }

  const chip = (nilai: string | null, label: string, jumlah: number) => {
    const aktif = tipe === nilai;
    return (
      <button
        key={label}
        type="button"
        aria-pressed={aktif}
        onClick={() => setParam("tipe", nilai)}
        className={cn(
          "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-8",
          aktif ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
        )}
      >
        {label}
        <span className={cn("rounded-full px-1.5 text-xs tabular-nums", aktif ? "bg-primary-foreground/15" : "bg-card")}>
          {jumlah}
        </span>
      </button>
    );
  };

  return (
    <Card className="gap-0 py-0 shadow-none">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
        <div
          role="group"
          aria-label="Saring tipe kamar"
          className="flex min-w-0 flex-wrap gap-1.5"
        >
          {chip(null, "Semua", kamar.length)}
          {daftarTipe.map((t) => chip(t, t, kamar.filter((k) => k.tipe === t).length))}
        </div>
        <select
          aria-label="Urutkan kamar kosong"
          className="h-11 w-full shrink-0 rounded-lg border border-input bg-card px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-10 sm:w-56 sm:text-sm"
          value={urut}
          onChange={(e) => setParam("urut", e.target.value === "nomor" ? null : e.target.value)}
        >
          {PILIHAN_URUT_KOSONG.map(({ value, label }) => (
            <option key={value} value={value}>
              Urut: {label}
            </option>
          ))}
        </select>
      </div>

      <p className="px-4 pt-3 text-sm text-muted-foreground" aria-live="polite">
        {tersaring.length} kamar · potensi sewa{" "}
        <span className="font-medium text-foreground tabular-nums">{formatRupiah(potensi)}</span>/bulan
      </p>

      <ul className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
        {tersaring.map((k) => (
          <li key={k.id}>
            <KartuKamarKosong kamar={k} hariIni={hariIni} onIsi={() => setIsiKamar(k.id)} />
          </li>
        ))}
      </ul>

      <SheetTambahPenghuni
        open={isiKamar !== null}
        onOpenChange={(buka) => !buka && setIsiKamar(null)}
        hariIni={hariIni}
        kamarKosong={kamar}
        roomIdAwal={isiKamar ?? undefined}
      />
    </Card>
  );
}
