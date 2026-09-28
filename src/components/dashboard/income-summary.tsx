import Link from "next/link";
import { ChevronRight, ShieldCheck } from "lucide-react";

import { hrefStatusFilter } from "@/components/dashboard/status-filter";
import {
  TONE_DOT,
  labelStatusInvoice,
  toneStatusInvoice,
} from "@/components/status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  formatPeriode,
  formatRupiah,
  formatRupiahSingkat,
  formatTanggalPendek,
  formatWaktu,
} from "@/lib/format";
import type { DashboardData } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Rekap Pemasukan Bulan Ini: uang masuk periode berjalan tanpa hitung manual. */
export function IncomeSummary({
  periode,
  hariIni,
  tagihan,
  pemasukan,
}: Pick<DashboardData, "periode" | "hariIni" | "tagihan" | "pemasukan">) {
  const target = tagihan.total.nominal;
  const persen = target > 0 ? Math.round((pemasukan.bulanIni / target) * 100) : 0;
  const belumMasuk = Math.max(0, target - pemasukan.bulanIni);

  const rincian = (
    [
      { status: "lunas", rekap: tagihan.lunas },
      { status: "menunggu", rekap: tagihan.menunggu },
      { status: "jatuh_tempo", rekap: tagihan.jatuhTempo },
      { status: "perlu_review", rekap: tagihan.perluReview },
    ] as const
  ).filter(({ status, rekap }) => status !== "perlu_review" || rekap.jumlah > 0);

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>Pemasukan bulan ini</CardTitle>
        <CardDescription>
          {formatPeriode(periode)} · per {formatTanggalPendek(hariIni)}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        <div>
          <p className="text-3xl font-semibold tracking-tight">
            {formatRupiah(pemasukan.bulanIni)}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            dari {pemasukan.jumlahPembayaran} pembayaran terverifikasi
          </p>
          <Progress
            value={persen}
            aria-label={`Terkumpul ${persen}% dari total tagihan`}
            className="mt-3 h-2 bg-accent"
          />
          <div className="mt-1.5 flex justify-between gap-3 text-xs text-muted-foreground">
            <span>
              <span className="font-medium text-foreground">{persen}%</span> dari{" "}
              {formatRupiahSingkat(target)}
            </span>
            <span>
              Belum masuk{" "}
              <span className="font-medium text-foreground">
                {formatRupiahSingkat(belumMasuk)}
              </span>
            </span>
          </div>
        </div>

        <ul className="-mx-2 flex flex-col" aria-label="Rincian tagihan per status">
          {rincian.map(({ status, rekap }) => (
            <li key={status}>
              <Link
                href={hrefStatusFilter(status)}
                className="group flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm transition-colors sm:py-1.5 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="flex min-w-0 items-center gap-2 whitespace-nowrap">
                  <span
                    aria-hidden="true"
                    className={cn("size-2 shrink-0 rounded-full", TONE_DOT[toneStatusInvoice(status)])}
                  />
                  {labelStatusInvoice(status)}
                  <span className="text-muted-foreground">
                    · {rekap.jumlah}
                    <span className="max-[359px]:sr-only"> tagihan</span>
                  </span>
                </span>
                <span className="flex items-center gap-1 font-medium tabular-nums">
                  {formatRupiahSingkat(rekap.nominal)}
                  <ChevronRight
                    aria-hidden="true"
                    className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>

        {pemasukan.terakhir.length > 0 && (
          <section aria-labelledby="pembayaran-terakhir">
            <h3
              id="pembayaran-terakhir"
              className="mb-2 text-xs font-medium text-muted-foreground"
            >
              Pembayaran terakhir
            </h3>
            <ul className="flex flex-col gap-2.5">
              {pemasukan.terakhir.map((p) => (
                <li key={p.id} className="flex items-center gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-md bg-success-soft text-[0.65rem] font-semibold text-success tabular-nums">
                    {p.nomorKamar}
                  </span>
                  <div className="min-w-0 flex-1 leading-tight">
                    <p className="truncate text-sm font-medium">{p.namaPenghuni}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatWaktu(p.diverifikasiPada)} · {p.metode}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-medium tabular-nums">
                    +{formatRupiah(p.nominalDibayar)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </CardContent>

      <CardFooter className="gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck aria-hidden="true" className="size-3.5 shrink-0 text-success" />
        Dihitung otomatis dari pembayaran yang terverifikasi gateway.
      </CardFooter>
    </Card>
  );
}
