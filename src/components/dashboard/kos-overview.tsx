import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { hrefStatusFilter } from "@/components/dashboard/status-filter";
import type { DashboardData } from "@/lib/types";
import { formatPeriode, formatRupiahSingkat } from "@/lib/format";
import { cn } from "@/lib/utils";

type Metrik = { label: string; nilai: string; catatan: string; href?: string };

/** Ringkasan kos sekilas (kamar, tagihan perlu ditagih, pemasukan) — deret angka bergaris. */
export function KosOverview({ data }: { data: DashboardData }) {
  const { periode, kamar, tagihan, pemasukan } = data;

  const metrik: Metrik[] = [
    { label: "Total kamar", nilai: String(kamar.total), catatan: `${kamar.kosong} masih kosong` },
    { label: "Terisi", nilai: String(kamar.terisi), catatan: `${kamar.persenTerisi}% hunian` },
    {
      label: "Perlu ditagih",
      nilai: String(tagihan.jatuhTempo.jumlah),
      catatan: `${formatRupiahSingkat(tagihan.jatuhTempo.nominal)} jatuh tempo`,
      href: hrefStatusFilter("jatuh_tempo"),
    },
    {
      label: "Masuk bulan ini",
      nilai: formatRupiahSingkat(pemasukan.bulanIni),
      catatan: `${tagihan.lunas.jumlah} dari ${tagihan.total.jumlah} lunas`,
    },
  ];

  return (
    <section aria-labelledby="kos-overview-title" className="rounded-lg border bg-card">
      <h2 id="kos-overview-title" className="flex items-baseline justify-between gap-2 border-b px-4 py-2.5 text-sm font-medium sm:px-5">
        Ringkasan bulan ini
        <span className="font-normal text-muted-foreground">Periode {formatPeriode(periode)}</span>
      </h2>
      <dl className="grid grid-cols-2 sm:grid-cols-4">
        {metrik.map(({ label, nilai, catatan, href }, i) => (
          <div
            key={label}
            className={cn(
              "relative min-w-0 px-4 py-4 sm:px-5",
              i % 2 === 1 && "border-l",
              i >= 2 && "border-t sm:border-t-0",
              i === 2 && "sm:border-l",
              href && "group transition-colors hover:bg-muted/60",
            )}
          >
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-3xl font-semibold tracking-[-0.02em]">
              {href ? (
                <Link
                  href={href}
                  className="rounded outline-none after:absolute after:inset-0 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {nilai}
                  <span className="sr-only"> — lihat tagihan {label.toLowerCase()}</span>
                </Link>
              ) : (
                nilai
              )}
            </dd>
            <dd className={cn("flex items-center gap-0.5 text-xs text-muted-foreground", href && "text-danger")}>
              {catatan}
              {href && (
                <ChevronRight aria-hidden="true" className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
