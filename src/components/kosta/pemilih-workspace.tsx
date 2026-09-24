"use client";

import { Building2, Check } from "lucide-react";

import type { WorkspaceRingkas } from "@/lib/types";
import { cn } from "@/lib/utils";

const LABEL_PERAN: Record<WorkspaceRingkas["peran"], string> = {
  owner: "Pemilik",
  admin: "Admin",
  penyewa: "Penyewa",
};

/** Pilih kos (workspace) yang sedang dikelola — untuk owner/admin dengan lebih dari satu kos. */
export function PemilihWorkspace({
  workspaces,
  aktifId,
  onPilih,
}: {
  workspaces: WorkspaceRingkas[];
  aktifId: string;
  onPilih: (workspace: WorkspaceRingkas) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Pilih kos" className="flex flex-col gap-2">
      {workspaces.map((ws) => {
        const aktif = ws.id === aktifId;
        return (
          <button
            key={ws.id}
            type="button"
            role="radio"
            aria-checked={aktif}
            onClick={() => onPilih(ws)}
            className={cn(
              "flex min-h-14 items-center gap-3 rounded-xl border bg-card px-3 py-2.5 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              aktif ? "border-primary/50 bg-accent/40" : "hover:bg-muted",
            )}
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
              <Building2 className="size-4.5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate font-medium">{ws.namaKos}</span>
              <span className="block text-xs text-muted-foreground">
                {ws.jumlahKamar} kamar · {LABEL_PERAN[ws.peran]}
              </span>
            </span>
            {aktif && <Check className="size-5 shrink-0 text-primary" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}
