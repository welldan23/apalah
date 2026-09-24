import { cn } from "@/lib/utils";

export function KosteraLogo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg
        viewBox="0 0 32 32"
        aria-hidden="true"
        className="size-7 shrink-0"
      >
        <rect width="32" height="32" rx="9" className="fill-primary" />
        <path
          d="M8 15.5 16 9l8 6.5"
          fill="none"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-accent"
        />
        <path
          d="M11 14.5V23h10v-8.5"
          fill="none"
          strokeWidth="2.4"
          strokeLinejoin="round"
          className="stroke-accent"
        />
        <rect x="14.5" y="17.5" width="3" height="5.5" rx="1" className="fill-accent" />
      </svg>
      <span className="text-[1.05rem] font-semibold tracking-tight text-foreground">
        Kostera
      </span>
    </span>
  );
}
