import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { DaftarJadwal } from "@/components/reminder/daftar-jadwal";
import { getHalamanJadwalPengingat } from "@/lib/data/halaman-reminder";

export const metadata: Metadata = {
  title: "Jadwal pengingat",
};

export default async function JadwalPengingatPage() {
  const data = await getHalamanJadwalPengingat();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <header>
        <Link
          href="/reminder"
          className="-ml-1 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Reminder
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Jadwal pengingat</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Atur kapan pengingat bayar dikirim, relatif terhadap tanggal jatuh tempo tiap penyewa.
        </p>
      </header>
      <DaftarJadwal {...data} />
    </div>
  );
}
