import Link from "next/link";
import { CircleCheck, CircleDot, Clock } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { formatWaktu } from "@/lib/format";
import { labelKategori, LABEL_STATUS_TIKET, URUTAN_STATUS_TIKET, type StatusTiket, type TiketPenyewa } from "@/lib/tiket";
import { cn } from "@/lib/utils";

const BADGE = {
  baru: { tone: "neutral", icon: CircleDot },
  diproses: { tone: "warning", icon: Clock },
  selesai: { tone: "success", icon: CircleCheck },
} as const satisfies Record<StatusTiket, unknown>;

/** Daftar tiket penyewa dengan langkah status Baru → Diproses → Selesai. */
export function DaftarTiket({ token, tiket }: { token: string; tiket: TiketPenyewa[] }) {
  if (tiket.length === 0) {
    return (
      <section className="flex flex-col items-center gap-3 rounded-2xl border bg-card px-5 py-10 text-center">
        <p className="font-medium">Belum ada tiket</p>
        <p className="text-sm text-muted-foreground">Laporkan kerusakan atau keluhan, nanti statusnya bisa dipantau di sini.</p>
        <Button asChild size="lg" className="mt-1 h-11">
          <Link href={`/invoice/${token}/tiket`}>Buat tiket</Link>
        </Button>
      </section>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {tiket.map((t) => {
        const langkah = URUTAN_STATUS_TIKET.indexOf(t.status);
        const badge = BADGE[t.status];
        return (
          <li key={t.id}>
            <article aria-labelledby={`tiket-${t.id}`} className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
              <header className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 id={`tiket-${t.id}`} className="font-medium">
                    {labelKategori(t.kategori)}
                  </h2>
                  <p className="text-xs text-muted-foreground tabular-nums">{t.nomor}</p>
                </div>
                <StatusBadge tone={badge.tone} icon={badge.icon} className="shrink-0">
                  {LABEL_STATUS_TIKET[t.status]}
                </StatusBadge>
              </header>
              <p className="text-sm">{t.deskripsi}</p>

              <ol aria-label="Tahap penanganan" className="grid grid-cols-3 gap-2">
                {URUTAN_STATUS_TIKET.map((s, i) => (
                  <li key={s} aria-current={i === langkah ? "step" : undefined} className="flex flex-col gap-1.5">
                    <span className={cn("h-1.5 rounded-full", i <= langkah ? "bg-primary" : "bg-muted")} />
                    <span className={cn("text-xs", i <= langkah ? "font-medium text-foreground" : "text-muted-foreground")}>
                      {LABEL_STATUS_TIKET[s]}
                    </span>
                  </li>
                ))}
              </ol>

              <p className="text-xs text-muted-foreground">
                Dibuat {formatWaktu(t.dibuatPada)}
                {t.diperbaruiPada !== t.dibuatPada && ` · diperbarui ${formatWaktu(t.diperbaruiPada)}`}
              </p>
            </article>
          </li>
        );
      })}
    </ul>
  );
}
