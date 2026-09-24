"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatPeriode, periodeBerikutnya, periodeSebelumnya } from "@/lib/format";

/** Pindah periode tagihan: bulan sebelumnya / berikutnya, plus kembali ke bulan ini. */
export function PeriodeNav({
  periode,
  periodeBerjalan,
  basePath = "/tagihan",
  pertahankanFilter = false,
}: {
  periode: string;
  periodeBerjalan: string;
  /** Halaman tujuan, mis. "/tagihan" atau "/pembayaran". */
  basePath?: string;
  /** Bawa parameter lain di URL (filter, pencarian) saat pindah periode. */
  pertahankanFilter?: boolean;
}) {
  const searchParams = useSearchParams();
  const href = (p?: string) => {
    const params = new URLSearchParams(pertahankanFilter ? searchParams.toString() : "");
    if (p) params.set("periode", p);
    else params.delete("periode");
    const query = params.toString();
    return `${basePath}${query ? `?${query}` : ""}`;
  };
  return (
    <nav aria-label="Pilih periode" className="flex items-center gap-1">
      <Button asChild variant="outline" size="icon-lg" className="size-10">
        <Link href={href(periodeSebelumnya(periode))} aria-label="Periode sebelumnya">
          <ChevronLeft />
        </Link>
      </Button>
      <p className="min-w-36 text-center text-sm font-semibold" aria-live="polite">
        {formatPeriode(periode)}
      </p>
      <Button asChild variant="outline" size="icon-lg" className="size-10">
        <Link href={href(periodeBerikutnya(periode))} aria-label="Periode berikutnya">
          <ChevronRight />
        </Link>
      </Button>
      {periode !== periodeBerjalan && (
        <Button asChild variant="ghost" size="lg" className="h-10">
          <Link href={href()}>Bulan ini</Link>
        </Button>
      )}
    </nav>
  );
}
