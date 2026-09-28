import Link from "next/link";

import { HREF_MASUK, HREF_MULAI } from "@/components/landing/links";
import { Button } from "@/components/ui/button";
import type { Cta } from "@/lib/landing/content";
import { cn } from "@/lib/utils";

/** Ajakan daftar penutup halaman; selalu menuju alur Daftar Kos. */
export function CtaSection({
  id,
  cta,
  className,
}: {
  id: string;
  cta: Cta;
  className?: string;
}) {
  return (
    <section aria-labelledby={`${id}-judul`} className={cn("border-t", className)}>
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.5fr_1fr] lg:items-end">
        <div>
          <h2
            id={`${id}-judul`}
            className="max-w-2xl text-4xl leading-[1.05] font-semibold tracking-[-0.03em] sm:text-5xl"
          >
            {cta.judul}
          </h2>
          <p className="mt-5 max-w-lg text-lg text-muted-foreground">{cta.deskripsi}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 lg:justify-end">
          <Button asChild size="lg" className="h-12 rounded-md px-6 text-base">
            <Link href={HREF_MULAI}>{cta.tombol}</Link>
          </Button>
          <Link
            href={HREF_MASUK}
            className="text-base font-medium underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground"
          >
            Sudah punya akun? Masuk
          </Link>
        </div>
      </div>
    </section>
  );
}
