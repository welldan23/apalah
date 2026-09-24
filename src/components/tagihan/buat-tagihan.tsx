"use client";

import { useState } from "react";
import { FilePlus2 } from "lucide-react";

import { ActionSheet } from "@/components/quick-actions/action-sheet";
import { InvoiceFlow } from "@/components/quick-actions/invoice-flow";
import { Button } from "@/components/ui/button";
import { periodeBerikutnya } from "@/lib/format";
import type { RoomCell } from "@/lib/types";

/** Tombol + sheet Buat Tagihan di halaman Tagihan & Invoice. */
export function BuatTagihan({
  periode,
  periodeBerjalan,
  kamar,
}: {
  /** Periode yang sedang dilihat. */
  periode: string;
  periodeBerjalan: string;
  /** Kamar terisi yang bisa ditagih. */
  kamar: RoomCell[];
}) {
  const [buka, setBuka] = useState(false);
  // Saat melihat bulan ini, tagihan biasanya untuk bulan depan; selain itu pakai bulan yang dilihat.
  const periodeAwal = periode === periodeBerjalan ? periodeBerikutnya(periode) : periode;

  return (
    <>
      <Button size="lg" className="h-10" aria-haspopup="dialog" onClick={() => setBuka(true)}>
        <FilePlus2 data-icon="inline-start" />
        Buat tagihan
      </Button>
      <ActionSheet
        open={buka}
        onOpenChange={setBuka}
        title="Buat tagihan"
        description="Pilih satu atau banyak kamar, nominal, dan jatuh tempo. Tagihan dibuat setelah kamu cek preview-nya."
      >
        <InvoiceFlow periode={periodeBerjalan} periodeAwal={periodeAwal} kamar={kamar} />
      </ActionSheet>
    </>
  );
}
