import type { KamarPenghuni } from "@/lib/data/kamar";
import { formatRupiahSingkat, formatTanggal } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Kartu satu kamar: nomor, status, penghuni aktif (atau siap ditawarkan), sewa. */
export function KartuKamar({ kamar }: { kamar: KamarPenghuni }) {
  const kosong = kamar.status === "kosong";
  const sewa = kamar.penghuni?.hargaSewa ?? kamar.hargaSewa;

  return (
    <article
      aria-label={`Kamar ${kamar.nomorKamar}, ${kosong ? "kosong" : `terisi oleh ${kamar.penghuni?.nama ?? "penghuni"}`}`}
      className={cn(
        "flex h-full flex-col gap-2 rounded-xl border bg-card p-3",
        kosong && "border-dashed border-warning/60 bg-warning-soft/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-lg font-semibold tabular-nums">{kamar.nomorKamar}</span>
        <span
          className={cn(
            "inline-flex h-5 items-center rounded-full px-2 text-xs font-medium",
            kosong ? "bg-warning-soft text-warning" : "bg-accent text-accent-foreground",
          )}
        >
          {kosong ? "Kosong" : "Terisi"}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm font-medium", kosong && "text-warning")}>
          {kamar.penghuni?.nama ?? "Siap ditawarkan"}
        </p>
        {kamar.penghuni && (
          <p className="truncate text-xs text-muted-foreground">
            Masuk {formatTanggal(kamar.penghuni.tanggalMasuk)}
          </p>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground tabular-nums">{formatRupiahSingkat(sewa)}</span>/bln
      </p>
    </article>
  );
}
