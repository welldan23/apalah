import { FilePlus2, MessagesSquare, Send } from "lucide-react";

import { labelHari, type RingkasanHari } from "@/lib/riwayat-kosta";
import type { StatusDraftAksi } from "@/lib/types";
import { cn } from "@/lib/utils";

const LABEL_STATUS: Record<StatusDraftAksi, string> = {
  menunggu_konfirmasi: "menunggu konfirmasi",
  disetujui: "diproses",
  dijalankan: "terkirim",
  dibatalkan: "dibatalkan",
};

/** Riwayat percakapan tersimpan per hari; pilih satu hari untuk melompat ke percakapannya. */
export function PanelRiwayat({
  riwayat,
  hariIni,
  onPilih,
  className,
}: {
  riwayat: RingkasanHari[];
  hariIni: string;
  onPilih: (tanggal: string) => void;
  className?: string;
}) {
  if (riwayat.length === 0) {
    return <p className={cn("p-4 text-sm text-muted-foreground", className)}>Belum ada percakapan.</p>;
  }

  return (
    <ul aria-label="Riwayat percakapan" className={cn("flex flex-col gap-1.5", className)}>
      {riwayat.map((hari) => (
        <li key={hari.tanggal}>
          <button
            type="button"
            onClick={() => onPilih(hari.tanggal)}
            className="flex w-full flex-col gap-1 rounded-xl border bg-card px-3 py-2.5 text-left transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{labelHari(hari.tanggal, hariIni)}</span>
              <span className="flex items-center gap-1">
                <MessagesSquare className="size-3.5" aria-hidden="true" />
                {hari.jumlahPesan} pesan
              </span>
            </span>
            <span className="line-clamp-2 text-sm">{hari.topik || "Pesan dari Kosta"}</span>
            {hari.aksi.map((a, i) => (
              <span key={i} className="flex items-center gap-1 text-xs text-muted-foreground">
                {a.aksi === "reminder" ? (
                  <Send className="size-3.5" aria-hidden="true" />
                ) : (
                  <FilePlus2 className="size-3.5" aria-hidden="true" />
                )}
                {a.aksi === "reminder" ? "Reminder" : "Tagihan"} · {LABEL_STATUS[a.status]}
              </span>
            ))}
          </button>
        </li>
      ))}
    </ul>
  );
}
