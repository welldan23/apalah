import type { Metadata } from "next";

import { DaftarTiketOwner } from "@/components/tiket/daftar-tiket-owner";
import { getHalamanTiketOwner } from "@/lib/data/halaman-tiket";
import { hitungTiket } from "@/lib/tiket";

export const metadata: Metadata = {
  title: "Tiket keluhan",
};

export default async function TiketPage() {
  const data = await getHalamanTiketOwner();
  const jumlah = hitungTiket(data.tiket);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 lg:gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Tiket keluhan</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Keluhan & permintaan perbaikan dari penyewa {data.namaKos} · {jumlah.baru} baru · {jumlah.diproses} diproses
        </p>
      </header>
      <DaftarTiketOwner tiket={data.tiket} />
    </div>
  );
}
