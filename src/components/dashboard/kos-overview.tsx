import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { hrefStatusFilter } from "@/components/dashboard/status-filter";
import type { DashboardData } from "@/lib/types";
import { formatPeriode, formatRupiahSingkat } from "@/lib/format";
import { cn } from "@/lib/utils";

type Metrik = { label: string; nilai: string; catatan: string; href?: string };

/** Kartu utama: kondisi kos sekilas (kamar, tagihan perlu ditagih, pemasukan). */
export function KosOverview({ data }: { data: DashboardData }) {
  const { organization, periode, kamar, tagihan, pemasukan } = data;

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
    <section
      aria-labelledby="kos-overview-title"
      className="relative overflow-hidden rounded-2xl bg-primary px-5 py-5 text-primary-foreground sm:px-6"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-16 size-64 rounded-full border-[28px] border-accent/10"
      />
      <div className="relative flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 id="kos-overview-title" className="text-lg font-semibold tracking-tight">
            {organization.namaKos}
          </h2>
          <p className="truncate text-sm text-primary-foreground/70">
            {organization.alamat}
          </p>
        </div>
        <span className="rounded-full bg-accent/15 px-2.5 py-1 text-xs font-medium text-accent">
          Periode {formatPeriode(periode)}
        </span>
      </div>

      <dl className="relative mt-5 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
        {metrik.map(({ label, nilai, catatan, href }) => (
          <div
            key={label}
            className={cn(
              "relative min-w-0 border-l border-primary-foreground/15 pl-3",
              href && "group -my-1 rounded-r-lg py-1 transition-colors hover:bg-primary-foreground/5",
            )}
          >
            <dt className="text-xs text-primary-foreground/70">{label}</dt>
            <dd className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight">
              {href ? (
                <Link
                  href={href}
                  className="rounded outline-none after:absolute after:inset-0 focus-visible:ring-3 focus-visible:ring-accent/40"
                >
                  {nilai}
                  <span className="sr-only"> — lihat tagihan {label.toLowerCase()}</span>
                </Link>
              ) : (
                nilai
              )}
            </dd>
            <dd className="flex items-center gap-0.5 text-xs text-accent/90">
              {catatan}
              {href && (
                <ChevronRight
                  aria-hidden="true"
                  className="size-3.5 transition-transform group-hover:translate-x-0.5"
                />
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
