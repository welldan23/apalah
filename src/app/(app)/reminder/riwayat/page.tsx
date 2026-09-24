import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { TabelRiwayatReminder } from "@/components/reminder/tabel-riwayat-reminder";
import { PeriodeNav } from "@/components/tagihan/periode-nav";
import { getHalamanRiwayatReminder } from "@/lib/data/halaman-reminder";
import { formatPeriode } from "@/lib/format";

export const metadata: Metadata = {
  title: "Riwayat reminder",
};

export default async function RiwayatReminderPage({ searchParams }: PageProps<"/reminder/riwayat">) {
  const { periode } = await searchParams;
  const data = await getHalamanRiwayatReminder(typeof periode === "string" ? periode : undefined);
  const { terkirim, gagal, penyewa } = data.statistik;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 lg:gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href="/reminder"
            className="-ml-1 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            Reminder
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Riwayat reminder</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatPeriode(data.periode)} · {terkirim} terkirim ·{" "}
            <span className={gagal > 0 ? "text-danger" : undefined}>{gagal} gagal</span> · {penyewa} penyewa diingatkan
          </p>
        </div>
        <PeriodeNav periode={data.periode} periodeBerjalan={data.periodeBerjalan} basePath="/reminder/riwayat" />
      </header>

      <TabelRiwayatReminder riwayat={data.riwayat} periode={data.periode} />
      {data.terpotong && (
        <p className="text-xs text-muted-foreground">
          Hanya {data.riwayat.length} pengingat terbaru di bulan ini yang ditampilkan.
        </p>
      )}
    </div>
  );
}
