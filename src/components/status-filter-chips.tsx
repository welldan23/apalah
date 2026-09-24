"use client";

import {
  STATUS_FILTER,
  type StatusFilter,
} from "@/components/dashboard/status-filter";
import type { InvoiceRow } from "@/lib/types";
import { cn } from "@/lib/utils";

// Filter yang selalu tampil walau jumlahnya nol (status utama di PRD).
const FILTER_TETAP = new Set<StatusFilter>(["semua", "jatuh_tempo", "menunggu", "lunas"]);

/** Chip saring status invoice, lengkap dengan jumlah per status. */
export function StatusFilterChips({
  invoices,
  filter,
  onChange,
  className,
}: {
  invoices: Pick<InvoiceRow, "status">[];
  filter: StatusFilter;
  onChange: (filter: StatusFilter) => void;
  className?: string;
}) {
  const jumlah = (f: StatusFilter) =>
    f === "semua" ? invoices.length : invoices.filter((inv) => inv.status === f).length;
  const pilihan = STATUS_FILTER.filter(
    (f) => FILTER_TETAP.has(f.value) || f.value === filter || jumlah(f.value) > 0,
  );

  return (
    <div
      role="group"
      aria-label="Saring status tagihan"
      className={cn("flex gap-1.5 overflow-x-auto [scrollbar-width:none]", className)}
    >
      {pilihan.map(({ value, label }) => {
        const aktif = filter === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={aktif}
            onClick={() => onChange(value)}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium sm:h-8 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              aktif
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
            <span
              className={cn(
                "rounded-full px-1.5 text-xs tabular-nums",
                aktif ? "bg-primary-foreground/15" : "bg-card",
                !aktif && value === "jatuh_tempo" && jumlah(value) > 0 && "text-danger",
              )}
            >
              {jumlah(value)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
