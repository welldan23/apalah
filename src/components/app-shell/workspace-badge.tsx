import { Building2 } from "lucide-react";

import type { Organization } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Nama kos yang sedang dikelola. Pemilihan workspace menyusul (Fase 3). */
export function WorkspaceBadge({
  organization,
  compact = false,
  className,
}: {
  organization: Organization;
  /** Tanpa ikon & bingkai, rata kanan — untuk header mobile. */
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2",
        compact ? "text-right" : "rounded-lg border bg-card px-2.5 py-1.5",
        className,
      )}
    >
      {!compact && (
        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground">
          <Building2 className="size-4" />
        </span>
      )}
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-sm font-semibold">
          {organization.namaKos}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {organization.jumlahKamar} kamar
        </span>
      </span>
    </div>
  );
}
