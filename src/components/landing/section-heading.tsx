import { cn } from "@/lib/utils";

export function SectionHeading({
  id,
  eyebrow,
  judul,
  deskripsi,
  className,
}: {
  id: string;
  eyebrow: string;
  judul: string;
  deskripsi?: string;
  className?: string;
}) {
  return (
    <div className={cn("max-w-2xl", className)}>
      <p className="text-sm font-medium text-primary">{eyebrow}</p>
      <h2 id={id} className="mt-2 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
        {judul}
      </h2>
      {deskripsi && (
        <p className="mt-3 text-base text-pretty text-muted-foreground">{deskripsi}</p>
      )}
    </div>
  );
}
