import type { Metadata } from "next";

import { PilihWorkspace } from "@/components/auth/pilih-workspace";
import { TombolKeluar } from "@/components/auth/tombol-keluar";
import { getHalamanPilihKos } from "@/lib/data/halaman-pilih-kos";

export const metadata: Metadata = {
  title: "Pilih kos",
  robots: { index: false, follow: false },
};

export default async function PilihKosPage() {
  const data = await getHalamanPilihKos();
  const namaDepan = data.namaPengguna.split(" ")[0];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Halo, {namaDepan}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kamu mengelola {data.workspaces.length} kos. Pilih kos yang mau dibuka — bisa diganti kapan saja.
        </p>
      </div>
      <PilihWorkspace workspaces={data.workspaces} aktifId={data.aktifId} />
      <TombolKeluar className="self-center text-muted-foreground" />
    </div>
  );
}
