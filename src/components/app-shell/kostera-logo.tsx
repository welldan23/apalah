import { cn } from "@/lib/utils";

/** Tanda Kostera: gantungan kunci kamar kos (berlubang, huruf K) + wordmark huruf kecil. */
export function KosteraLogo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg viewBox="0 0 22 30" aria-hidden="true" className="h-7 w-auto shrink-0">
        <path
          fillRule="evenodd"
          className="fill-primary"
          d="M5 1h12a4 4 0 0 1 4 4v19.5L11 29 1 24.5V5a4 4 0 0 1 4-4Zm6 3.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8Z"
        />
        <path
          d="M7.5 13v10M14.5 13l-5.6 5 5.6 5"
          fill="none"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-primary-foreground"
        />
      </svg>
      <span className="text-[1.15rem] leading-none font-semibold tracking-[-0.01em] text-foreground">kostera</span>
    </span>
  );
}
