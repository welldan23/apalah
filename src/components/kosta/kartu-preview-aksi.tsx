import { CircleCheck, CircleDashed, CircleX, Clock, type LucideIcon } from "lucide-react";

import { KonfirmasiAksi } from "@/components/kosta/konfirmasi-aksi";
import { StatusBadge, type StatusTone } from "@/components/status-badge";
import { formatPeriode, formatRupiah } from "@/lib/format";
import type { PreviewAksi, StatusDraftAksi } from "@/lib/types";

const JUDUL: Record<PreviewAksi["aksi"], string> = {
  reminder: "Preview reminder",
  tagihan: "Preview tagihan",
};

const STATUS: Record<StatusDraftAksi, { label: string; tone: StatusTone; icon: LucideIcon; petunjuk: string }> = {
  menunggu_konfirmasi: {
    label: "Menunggu konfirmasi",
    tone: "warning",
    icon: Clock,
    petunjuk: "Cek penerima dan nominal. Tidak ada yang dikirim sebelum kamu konfirmasi.",
  },
  disetujui: {
    label: "Disetujui",
    tone: "info",
    icon: CircleDashed,
    petunjuk: "Disetujui, sedang diproses.",
  },
  dijalankan: {
    label: "Terkirim",
    tone: "success",
    icon: CircleCheck,
    petunjuk: "Sudah dijalankan dan tercatat di riwayat.",
  },
  dibatalkan: {
    label: "Dibatalkan",
    tone: "neutral",
    icon: CircleX,
    petunjuk: "Dibatalkan, tidak ada yang dikirim.",
  },
};

const MAKS_DITAMPILKAN = 5;

/** Kartu preview aksi Kosta: penerima, periode, dan nominal sebelum owner mengonfirmasi. */
export function KartuPreviewAksi({
  preview,
  onPutuskan,
}: {
  preview: PreviewAksi;
  /** Tanpa handler, kartu hanya tampilan (tanpa tombol Setuju/Batal). */
  onPutuskan?: (keputusan: "setuju" | "batal") => void;
}) {
  const status = STATUS[preview.status];
  const tampil = preview.penerima.slice(0, MAKS_DITAMPILKAN);
  const sisa = preview.penerima.length - tampil.length;

  return (
    <figure className="mt-2 overflow-hidden rounded-lg border bg-background/70 text-xs">
      <figcaption className="flex items-center justify-between gap-2 border-b px-2.5 py-1.5">
        <span className="font-medium">{JUDUL[preview.aksi]}</span>
        <StatusBadge tone={status.tone} icon={status.icon}>
          {status.label}
        </StatusBadge>
      </figcaption>

      <dl className="divide-y">
        {(
          [
            ["Penerima", `${preview.penerima.length} penyewa`],
            ["Periode", formatPeriode(preview.periode)],
            ["Total nominal", formatRupiah(preview.total)],
          ] as const
        ).map(([label, nilai]) => (
          <div key={label} className="flex justify-between gap-3 px-2.5 py-1.5">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium tabular-nums">{nilai}</dd>
          </div>
        ))}
      </dl>

      <ul aria-label="Daftar penerima" className="divide-y border-t bg-muted/40">
        {tampil.map((p) => (
          <li key={p.nomorKamar} className="flex justify-between gap-3 px-2.5 py-1.5">
            <span className="min-w-0 truncate">
              <span className="font-medium tabular-nums">{p.nomorKamar}</span> · {p.nama}
            </span>
            <span className="shrink-0 tabular-nums">{formatRupiah(p.nominal)}</span>
          </li>
        ))}
        {sisa > 0 && <li className="px-2.5 py-1.5 text-muted-foreground">+{sisa} penerima lainnya</li>}
      </ul>

      <p className="border-t px-2.5 py-1.5 text-muted-foreground" aria-live="polite">
        {status.petunjuk}
      </p>
      {preview.status === "menunggu_konfirmasi" && onPutuskan && (
        <KonfirmasiAksi preview={preview} onPutuskan={onPutuskan} />
      )}
    </figure>
  );
}
