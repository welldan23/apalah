import { CircleAlert, CircleCheck } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { HalamanReminder } from "@/lib/data/halaman-reminder";
import { formatPeriode, formatRupiah, formatWaktu } from "@/lib/format";
import { labelJenisReminder } from "@/lib/reminder";

/** Pengingat terbaru: siapa, kapan, jenis, dan hasil kirim. */
export function RiwayatReminderTerbaru({ riwayat }: Pick<HalamanReminder, "riwayat">) {
  return (
    <Card className="gap-0 py-0 shadow-none">
      <CardHeader className="border-b py-4">
        <CardTitle>Riwayat terbaru</CardTitle>
        <CardDescription>Pengingat yang sudah dikirim ke penyewa.</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {riwayat.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">Belum ada pengingat yang dikirim.</p>
        ) : (
          <ul className="divide-y">
            {riwayat.map((r) => (
              <li key={r.id} className="flex items-start gap-3 px-4 py-3 text-sm">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-xs font-semibold tabular-nums">
                  {r.nomorKamar}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.namaPenghuni}</p>
                  <p className="text-xs text-muted-foreground">
                    {labelJenisReminder(r.jenis)} · {formatWaktu(r.terkirimPada)} · {formatPeriode(r.periode)}{" "}
                    <span className="tabular-nums">{formatRupiah(r.nominal)}</span>
                  </p>
                </div>
                {r.status === "terkirim" ? (
                  <StatusBadge tone="success" icon={CircleCheck} className="shrink-0">
                    Terkirim
                  </StatusBadge>
                ) : (
                  <StatusBadge tone="danger" icon={CircleAlert} className="shrink-0">
                    Gagal
                  </StatusBadge>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
