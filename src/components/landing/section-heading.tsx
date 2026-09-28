import { cn } from "@/lib/utils";

/** Judul seksi landing: judul besar + satu paragraf, tanpa label kecil di atasnya. */
export function SectionHeading({
  id,
  judul,
  deskripsi,
  className,
}: {
  id: string;
  judul: string;
  deskripsi?: string;
  className?: string;
}) {
  return (
    <div className={cn("max-w-2xl", className)}>
      <h2 id={id} className="text-3xl leading-[1.1] font-semibold tracking-[-0.02em] sm:text-4xl">
        {judul}
      </h2>
      {deskripsi && <p className="mt-4 text-lg text-pretty text-muted-foreground">{deskripsi}</p>}
    </div>
  );
}
