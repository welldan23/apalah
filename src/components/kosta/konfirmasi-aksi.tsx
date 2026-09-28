import { ArrowRightLeft, DoorOpen, FilePlus2, Send, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LABEL_AKSI } from "@/lib/draft-aksi";
import type { PreviewAksi } from "@/lib/types";

const IKON = { reminder: Send, tagihan: FilePlus2, pindah_kamar: ArrowRightLeft, keluar_penghuni: DoorOpen } as const;

/** Tombol Setuju / Batal di kartu preview — hanya saat draft menunggu konfirmasi. */
export function KonfirmasiAksi({
  preview,
  onPutuskan,
}: {
  preview: PreviewAksi;
  onPutuskan: (keputusan: "setuju" | "batal") => void;
}) {
  const jumlah = preview.penerima.length;
  const Ikon = IKON[preview.aksi];
  return (
    <div className="flex gap-2 border-t p-2">
      <Button
        variant="outline"
        size="lg"
        className="h-11 flex-1 bg-card"
        onClick={() => onPutuskan("batal")}
      >
        <X data-icon="inline-start" />
        Batal
      </Button>
      <Button size="lg" className="h-11 flex-[1.6]" onClick={() => onPutuskan("setuju")}>
        <Ikon data-icon="inline-start" />
        Setuju & {LABEL_AKSI[preview.aksi].kerja}
        {preview.aksi === "reminder" || preview.aksi === "tagihan" ? ` (${jumlah})` : ""}
      </Button>
    </div>
  );
}
