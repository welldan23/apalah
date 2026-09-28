import Link from "next/link";
import { Building2, ChevronsUpDown } from "lucide-react";

import type { Organization } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Nama kos yang sedang dikelola; ketuk untuk pindah kos (halaman Pilih kos). */
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
    <Link
      href="/pilih-kos"
      aria-label={`${organization.namaKos}, ${organization.jumlahKamar} kamar — ganti kos`}
      className={cn(
        "flex min-h-11 min-w-0 items-center gap-2 rounded-lg transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        compact ? "text-right" : "border bg-card px-2.5 py-1.5 hover:border-primary/40",
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
      {!compact && <ChevronsUpDown className="ml-auto size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
    </Link>
  );
}
