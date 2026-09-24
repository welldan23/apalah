"use client";

import { Input } from "@/components/ui/input";
import { formatAngka } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Input nominal rupiah: hanya angka, tampil dengan pemisah ribuan. */
export function RupiahInput({
  value,
  onChange,
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> & {
  value: number | null;
  onChange: (nilai: number | null) => void;
}) {
  return (
    <div className={cn("relative", className)}>
      <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-muted-foreground">
        Rp
      </span>
      <Input
        {...props}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className="h-10 bg-card pl-8 tabular-nums"
        value={value === null ? "" : formatAngka(value)}
        onChange={(e) => {
          const digit = e.target.value.replace(/\D/g, "").slice(0, 12);
          onChange(digit ? Number(digit) : null);
        }}
      />
    </div>
  );
}
