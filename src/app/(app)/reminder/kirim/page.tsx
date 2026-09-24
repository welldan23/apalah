import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { PilihPenerima } from "@/components/reminder/pilih-penerima";
import { getHalamanKirimReminder } from "@/lib/data/halaman-reminder";

export const metadata: Metadata = {
  title: "Kirim reminder massal",
};

export default async function KirimReminderPage() {
  const data = await getHalamanKirimReminder();

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
        <h1 className="text-2xl font-semibold tracking-tight">Kirim reminder massal</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pilih penyewa yang mau diingatkan. Pesan baru terkirim setelah kamu cek preview dan konfirmasi.
        </p>
      </header>
      <PilihPenerima {...data} />
    </div>
  );
}
