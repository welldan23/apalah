import Link from "next/link";
import { CalendarClock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { HalamanReminder } from "@/lib/data/halaman-reminder";
import { keteranganJadwal, labelJadwal } from "@/lib/reminder";
import { cn } from "@/lib/utils";

/** Jadwal pengingat otomatis relatif terhadap jatuh tempo. */
export function KartuJadwal({ jadwal, otomatisAktif }: Pick<HalamanReminder, "jadwal" | "otomatisAktif">) {
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="size-4 text-primary" aria-hidden="true" />
          Jadwal otomatis
        </CardTitle>
        <CardDescription>
          {otomatisAktif ? "Aktif — dikirim ke penyewa yang belum bayar." : "Nonaktif — pengingat hanya dikirim manual."}
        </CardDescription>
        <CardAction>
          <Button asChild variant="ghost" size="sm">
            <Link href="/reminder/jadwal">Atur</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ul className="divide-y rounded-lg border">
          {jadwal.map((j) => (
            <li key={j.offsetHari} className={cn("flex items-center gap-3 px-3 py-2.5 text-sm", !j.aktif && "opacity-50")}>
              <span className="grid h-7 min-w-11 place-items-center rounded-md bg-accent px-1.5 text-xs font-semibold text-accent-foreground">
                {labelJadwal(j.offsetHari)}
              </span>
              <span className="min-w-0 flex-1">{keteranganJadwal(j.offsetHari)}</span>
              <span className="shrink-0 text-muted-foreground tabular-nums">{j.aktif ? `${j.jam.replace(":", ".")} WIB` : "Mati"}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Tagihan yang sudah lunas tidak diingatkan. Setiap pesan berisi nominal dan link invoice.
        </p>
      </CardContent>
    </Card>
  );
}
