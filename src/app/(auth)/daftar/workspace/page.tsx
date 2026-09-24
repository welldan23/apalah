import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { FormWorkspace } from "@/components/auth/form-workspace";
import { normalisasiNomorWa } from "@/lib/nomor-wa";

export const metadata: Metadata = {
  title: "Siapkan kos",
  robots: { index: false, follow: false },
};

export default async function WorkspaceBaruPage({ searchParams }: PageProps<"/daftar/workspace">) {
  const { nomor } = await searchParams;
  const nomorWa = typeof nomor === "string" ? normalisasiNomorWa(nomor) : null;
  if (!nomorWa) redirect("/daftar");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Siapkan kos pertamamu</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tinggal satu langkah. Workspace kos kamu dibuat otomatis dari data ini — kos lain bisa ditambah nanti.
        </p>
      </div>
      <FormWorkspace nomorWa={nomorWa} />
    </div>
  );
}
