"use client";

import { cn } from "@/lib/utils";

/** Saklar nyala/mati (role="switch") dengan area sentuh ≥ 44px. */
export function Saklar({
  nyala,
  onUbah,
  labelledBy,
  label,
  disabled,
}: {
  nyala: boolean;
  onUbah: (nyala: boolean) => void;
  labelledBy?: string;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={nyala}
      aria-labelledby={labelledBy}
      aria-label={label}
      disabled={disabled}
      onClick={() => onUbah(!nyala)}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-40 after:absolute after:-inset-2",
        nyala ? "bg-primary" : "bg-muted-foreground/30",
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-5 rounded-full bg-card shadow-xs transition-transform", nyala ? "translate-x-6" : "translate-x-1")}
      />
    </button>
  );
}
