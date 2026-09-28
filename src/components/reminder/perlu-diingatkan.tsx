"use client";

import { useState } from "react";
import Link from "next/link";
import { Send } from "lucide-react";

import { ActionSheet } from "@/components/quick-actions/action-sheet";
import { ReminderFlow } from "@/components/quick-actions/reminder-flow";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { HalamanReminder } from "@/lib/data/halaman-reminder";
import { formatPeriode, formatRupiah, selisihHari } from "@/lib/format";

/** Tagihan jatuh tempo yang bisa diingatkan sekarang, lewat preview & konfirmasi. */
export function PerluDiingatkan({ menunggak, hariIni, periode }: Pick<HalamanReminder, "menunggak" | "hariIni" | "periode">) {
  const [buka, setBuka] = useState(false);
  const total = menunggak.reduce((jumlah, t) => jumlah + t.nominal, 0);

  return (
    <Card className="gap-0 py-0 shadow-none">
      <CardHeader className="border-b py-4">
        <CardTitle>Perlu diingatkan</CardTitle>
        <CardDescription>
          {menunggak.length > 0
            ? `${menunggak.length} tagihan lewat jatuh tempo · ${formatRupiah(total)}`
            : "Tidak ada tagihan yang lewat jatuh tempo."}
        </CardDescription>
        {menunggak.length > 0 && (
          <CardAction>
            <Button size="sm" className="h-9" aria-haspopup="dialog" onClick={() => setBuka(true)}>
              <Send data-icon="inline-start" />
              <span className="sm:hidden">Kirim ({menunggak.length})</span>
              <span className="hidden sm:inline">Kirim reminder massal ({menunggak.length})</span>
            </Button>
          </CardAction>
        )}
      </CardHeader>
      {menunggak.length > 0 && (
        <CardContent className="px-0">
          <ul className="divide-y">
            {menunggak.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-danger-soft text-xs font-semibold text-danger tabular-nums">
                  {t.nomorKamar}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{t.namaPenghuni}</p>
                  <p className="text-xs text-muted-foreground">
                    Lewat {selisihHari(t.jatuhTempo, hariIni)} hari
                    {t.periode !== periode && ` · ${formatPeriode(t.periode)}`}
                  </p>
                </div>
                <span className="shrink-0 font-medium tabular-nums">{formatRupiah(t.nominal)}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      )}
      <div className="border-t px-4 py-3">
        <Link href="/reminder/kirim" className="text-sm font-medium text-primary hover:underline">
          Pilih penerima lain, termasuk yang belum jatuh tempo →
        </Link>
      </div>

      <ActionSheet
        open={buka}
        onOpenChange={setBuka}
        title="Kirim reminder massal"
        description="Cek penerima, periode, dan nominal dulu. Pesan baru terkirim setelah kamu konfirmasi."
      >
        <ReminderFlow periode={periode} hariIni={hariIni} tagihan={menunggak} />
      </ActionSheet>
    </Card>
  );
}
