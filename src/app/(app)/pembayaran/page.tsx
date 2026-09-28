import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";

import { BannerPerluReview } from "@/components/pembayaran/banner-perlu-review";
import { DaftarPembayaran } from "@/components/pembayaran/daftar-pembayaran";
import { PeriodeNav } from "@/components/tagihan/periode-nav";
import { getHalamanPembayaran } from "@/lib/data/pemantauan";
import { formatPeriode } from "@/lib/format";

export const metadata: Metadata = {
  title: "Pembayaran",
};

export default async function PembayaranPage({ searchParams }: PageProps<"/pembayaran">) {
  const { periode } = await searchParams;
  const data = await getHalamanPembayaran(typeof periode === "string" ? periode : undefined);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 lg:gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pembayaran</h1>
          <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
            Tagihan {formatPeriode(data.periode)}. Status Lunas hanya berubah dari pembayaran yang
            terverifikasi gateway.
          </p>
        </div>
        <PeriodeNav periode={data.periode} periodeBerjalan={data.periodeBerjalan} basePath="/pembayaran" />
      </header>

      <BannerPerluReview items={data.perluReview} />
      <DaftarPembayaran
        tagihan={data.tagihan}
        tagihanPerluReview={data.tagihanPerluReview}
        periode={data.periode}
        hariIni={data.hariIni}
      />
    </div>
  );
}
