import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { HREF_MULAI } from "@/components/landing/links";
import { Button } from "@/components/ui/button";
import { CTA_PENUTUP } from "@/lib/landing/content";

export function CtaSection() {
  return (
    <section aria-labelledby="cta-judul" className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
      <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-10 text-primary-foreground sm:px-10 sm:py-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -bottom-28 size-80 rounded-full border-[36px] border-accent/10"
        />
        <div className="relative max-w-xl">
          <h2 id="cta-judul" className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            {CTA_PENUTUP.judul}
          </h2>
          <p className="mt-3 text-primary-foreground/75">{CTA_PENUTUP.deskripsi}</p>
          <Button
            asChild
            size="lg"
            className="mt-7 h-11 bg-accent px-5 text-base text-accent-foreground hover:bg-accent/90"
          >
            <Link href={HREF_MULAI}>
              {CTA_PENUTUP.tombol}
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
