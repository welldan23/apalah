import type { Metadata } from "next";

import { IncomeSummary } from "@/components/dashboard/income-summary";
import { InvoiceStatusTable } from "@/components/dashboard/invoice-status-table";
import { KosOverview } from "@/components/dashboard/kos-overview";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { RoomSummary } from "@/components/dashboard/room-summary";
import { getDashboardData } from "@/lib/data/dashboard";
import { formatHari } from "@/lib/format";

export const metadata: Metadata = {
  title: "Dashboard Kos",
};

export default async function DashboardPage() {
  const data = await getDashboardData();
  const namaDepan = data.owner.nama.split(" ")[0];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 lg:gap-6">
      <div className="grid min-w-0 gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <header className="lg:col-start-1 lg:row-start-1">
          <p className="text-sm text-muted-foreground">{formatHari(data.hariIni)}</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">
            Halo, {namaDepan}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ini kondisi {data.organization.namaKos} hari ini.
          </p>
        </header>

        <div className="order-2 lg:order-none lg:col-span-2 lg:row-start-2">
          <KosOverview data={data} />
        </div>

        <div className="order-3 lg:order-none lg:col-start-2 lg:row-start-1">
          <h2 className="sr-only">Aksi cepat</h2>
          <QuickActions
            namaKos={data.organization.namaKos}
            periode={data.periode}
            hariIni={data.hariIni}
            kamar={data.kamar.daftar}
            invoices={data.invoices}
          />
        </div>
      </div>

      {/* Mobile: tumpuk. Tablet: tabel penuh, pemasukan & kamar berdampingan.
          Desktop: tabel + kamar di kiri, pemasukan di kanan. */}
      <div className="grid items-start gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
        <div className="min-w-0 md:col-span-2">
          <InvoiceStatusTable
            invoices={data.invoices}
            periode={data.periode}
            hariIni={data.hariIni}
          />
        </div>
        <div className="min-w-0 lg:col-start-3 lg:row-span-2 lg:row-start-1">
          <IncomeSummary
            periode={data.periode}
            hariIni={data.hariIni}
            tagihan={data.tagihan}
            pemasukan={data.pemasukan}
          />
        </div>
        <div className="min-w-0 lg:col-span-2">
          <RoomSummary namaKos={data.organization.namaKos} kamar={data.kamar} />
        </div>
      </div>
    </div>
  );
}
