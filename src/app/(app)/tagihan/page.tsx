import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock } from "lucide-react";

import { BuatTagihan } from "@/components/tagihan/buat-tagihan";
import { DaftarInvoice } from "@/components/tagihan/daftar-invoice";
import { PeriodeNav } from "@/components/tagihan/periode-nav";
import { Button } from "@/components/ui/button";
import { getHalamanTagihan } from "@/lib/data/tagihan";
import { formatPeriode, formatRupiah } from "@/lib/format";

export const metadata: Metadata = {
  title: "Tagihan & Invoice",
};

export default async function TagihanPage({ searchParams }: PageProps<"/tagihan">) {
  const { periode } = await searchParams;
  const data = await getHalamanTagihan(typeof periode === "string" ? periode : undefined);
  const total = data.invoices.reduce((jumlah, inv) => jumlah + inv.nominal, 0);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 lg:gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tagihan &amp; Invoice</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.invoices.length} tagihan · {formatPeriode(data.periode)} · total{" "}
            {formatRupiah(total)}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <PeriodeNav periode={data.periode} periodeBerjalan={data.periodeBerjalan} />
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="lg" className="h-10">
              <Link href="/tagihan/terjadwal">
                <CalendarClock data-icon="inline-start" />
                Terjadwal
              </Link>
            </Button>
            <BuatTagihan
            periode={data.periode}
            periodeBerjalan={data.periodeBerjalan}
            hariIni={data.hariIni}
            kamar={data.kamarTerisi}
            />
          </div>
        </div>
      </header>

      <DaftarInvoice invoices={data.invoices} hariIni={data.hariIni} periode={data.periode} />
    </div>
  );
}
