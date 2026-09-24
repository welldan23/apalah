import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { FormWorkspace } from "@/components/auth/form-workspace";
import { getDb } from "@/db";
import { getSesiLogin } from "@/lib/auth/server";
import { daftarWorkspace } from "@/lib/kosta/workspace";

export const metadata: Metadata = {
  title: "Siapkan kos",
  robots: { index: false, follow: false },
};

export default async function WorkspaceBaruPage() {
  const sesi = await getSesiLogin(await headers());
  const nomorWa = sesi?.user.phoneNumber;
  if (!sesi || !nomorWa) redirect("/daftar");
  // Sudah mengelola kos (mis. masuk lagi lewat halaman daftar) → langsung pilih kos.
  if ((await daftarWorkspace(await getDb(), sesi.user.id)).length > 0) redirect("/pilih-kos");

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
