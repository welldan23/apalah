"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";

import { ActionSheet } from "@/components/quick-actions/action-sheet";
import { TenantFlow } from "@/components/quick-actions/tenant-flow";
import { Button } from "@/components/ui/button";
import type { RoomCell } from "@/lib/types";

/** Sheet Tambah penghuni; `roomIdAwal` memilih kamar kosong tertentu sejak awal. */
export function SheetTambahPenghuni({
  open,
  onOpenChange,
  hariIni,
  kamarKosong,
  roomIdAwal,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hariIni: string;
  kamarKosong: RoomCell[];
  roomIdAwal?: string;
}) {
  return (
    <ActionSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Tambah penghuni"
      description="Catat penghuni baru beserta kamar dan data sewanya."
    >
      <TenantFlow
        key={roomIdAwal ?? "baru"}
        hariIni={hariIni}
        kamarKosong={kamarKosong}
        roomIdAwal={roomIdAwal}
      />
    </ActionSheet>
  );
}

/** Tombol Tambah penghuni untuk header halaman. */
export function TombolTambahPenghuni({
  hariIni,
  kamarKosong,
}: {
  hariIni: string;
  kamarKosong: RoomCell[];
}) {
  const [buka, setBuka] = useState(false);
  return (
    <>
      <Button size="lg" className="h-10" aria-haspopup="dialog" onClick={() => setBuka(true)}>
        <UserPlus data-icon="inline-start" />
        Tambah penghuni
      </Button>
      <SheetTambahPenghuni open={buka} onOpenChange={setBuka} hariIni={hariIni} kamarKosong={kamarKosong} />
    </>
  );
}
