import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatPeriode, periodeBerikutnya, periodeSebelumnya } from "@/lib/format";

/** Pindah periode tagihan: bulan sebelumnya / berikutnya, plus kembali ke bulan ini. */
export function PeriodeNav({
  periode,
  periodeBerjalan,
  basePath = "/tagihan",
}: {
  periode: string;
  periodeBerjalan: string;
  /** Halaman tujuan, mis. "/tagihan" atau "/pembayaran". */
  basePath?: string;
}) {
  const href = (p: string) => `${basePath}?periode=${p}`;
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
          <Link href={basePath}>Bulan ini</Link>
        </Button>
      )}
    </nav>
  );
}
