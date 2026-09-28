"use client";

import { useState } from "react";
import { FilePlus2, Send, UserPlus } from "lucide-react";

import { ActionSheet } from "@/components/quick-actions/action-sheet";
import { InvoiceFlow } from "@/components/quick-actions/invoice-flow";
import { ReminderFlow } from "@/components/quick-actions/reminder-flow";
import { TenantFlow } from "@/components/quick-actions/tenant-flow";
import { Button } from "@/components/ui/button";
import type { InvoiceRow, RoomCell } from "@/lib/types";

type Aksi = "tagihan" | "penghuni" | "reminder";

// `pendek` dipakai di layar sempit supaya label tombol tidak pernah turun ke baris kedua.
const AKSI = [
  { id: "tagihan", label: "Buat tagihan", pendek: "Tagihan", icon: FilePlus2, variant: "default" },
  { id: "penghuni", label: "Tambah penghuni", pendek: "Penghuni", icon: UserPlus, variant: "outline" },
  { id: "reminder", label: "Kirim reminder", pendek: "Reminder", icon: Send, variant: "outline" },
] as const;

/** Aksi Cepat dari layar utama; tiap aksi lewat preview + konfirmasi owner. */
export function QuickActions({
  periode,
  hariIni,
  kamar,
  invoices,
}: {
  periode: string;
  hariIni: string;
  kamar: RoomCell[];
  invoices: InvoiceRow[];
}) {
  const [terbuka, setTerbuka] = useState<Aksi | null>(null);
  const tutup = (open: boolean) => !open && setTerbuka(null);
  const menunggak = invoices.filter((inv) => inv.status === "jatuh_tempo");

  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
        {AKSI.map(({ id, label, pendek, icon: Icon, variant }) => (
          <Button
            key={id}
            type="button"
            variant={variant}
            size="lg"
            aria-haspopup="dialog"
            aria-label={label}
            onClick={() => setTerbuka(id)}
            className="h-auto flex-col gap-1.5 px-2 py-3 text-xs sm:h-9 sm:flex-row sm:px-3 sm:py-0 sm:text-sm"
          >
            <Icon data-icon="inline-start" className="size-5 sm:size-4" />
            <span className="sm:hidden">{pendek}</span>
            <span className="hidden sm:inline">{label}</span>
          </Button>
        ))}
      </div>

      <ActionSheet
        open={terbuka === "tagihan"}
        onOpenChange={tutup}
        title="Buat tagihan"
        description="Pilih kamar, nominal, dan jatuh tempo. Tagihan dibuat setelah kamu cek preview-nya."
      >
        <InvoiceFlow
          periode={periode}
          hariIni={hariIni}
          kamar={kamar.filter((k) => k.status === "terisi")}
        />
      </ActionSheet>

      <ActionSheet
        open={terbuka === "penghuni"}
        onOpenChange={tutup}
        title="Tambah penghuni"
        description="Catat penghuni baru beserta kamar dan data sewanya."
      >
        <TenantFlow hariIni={hariIni} kamarKosong={kamar.filter((k) => k.status === "kosong")} />
      </ActionSheet>

      <ActionSheet
        open={terbuka === "reminder"}
        onOpenChange={tutup}
        title="Kirim reminder"
        description="Cek penerima, periode, dan nominal dulu. Pesan baru terkirim setelah kamu konfirmasi."
      >
        <ReminderFlow periode={periode} hariIni={hariIni} tagihan={menunggak} />
      </ActionSheet>
    </>
  );
}
