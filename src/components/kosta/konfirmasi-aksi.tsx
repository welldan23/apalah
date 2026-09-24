import { FilePlus2, Send, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PreviewAksi } from "@/lib/types";

/** Tombol Setuju / Batal di kartu preview — hanya saat draft menunggu konfirmasi. */
export function KonfirmasiAksi({
  preview,
  onPutuskan,
}: {
  preview: PreviewAksi;
  onPutuskan: (keputusan: "setuju" | "batal") => void;
}) {
  const jumlah = preview.penerima.length;
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
        {preview.aksi === "reminder" ? (
          <Send data-icon="inline-start" />
        ) : (
          <FilePlus2 data-icon="inline-start" />
        )}
        {preview.aksi === "reminder" ? `Setuju & kirim (${jumlah})` : `Setuju & buat (${jumlah})`}
      </Button>
    </div>
  );
}
