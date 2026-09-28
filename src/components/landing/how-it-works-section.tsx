import Link from "next/link";

import { HREF_MULAI } from "@/components/landing/links";
import { SectionHeading } from "@/components/landing/section-heading";
import { Button } from "@/components/ui/button";
import { CARA_KERJA, CTA_TENGAH } from "@/lib/landing/content";

export function HowItWorksSection() {
  return (
    <section
      id="cara-kerja"
      aria-labelledby="cara-kerja-judul"
      className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6 sm:py-24"
    >
      <div className="grid gap-10 lg:grid-cols-[1fr_1.5fr] lg:gap-16">
        <SectionHeading id="cara-kerja-judul" judul="Siapkan sekali, lalu cukup lewat chat" className="lg:sticky lg:top-24 lg:self-start" />
        <ol className="flex flex-col">
          {CARA_KERJA.map(({ judul, deskripsi, hasil }, i) => (
            <li key={judul} className="grid grid-cols-[2.5rem_1fr] gap-x-4 border-t py-6 first:border-t-2 first:border-foreground sm:grid-cols-[3.5rem_1fr]">
              <span aria-hidden="true" className="font-mono text-3xl leading-none font-medium text-muted-foreground/60 sm:text-4xl">
                {i + 1}
              </span>
              <div>
                <h3 className="text-xl font-semibold tracking-[-0.01em]">
                  <span className="sr-only">Langkah {i + 1}: </span>
                  {judul}
                </h3>
                <p className="mt-2 max-w-prose text-pretty text-muted-foreground">{deskripsi}</p>
                <p className="mt-3 text-sm font-medium text-primary">→ {hasil}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div
        id="cta-tengah"
        className="mt-12 flex flex-col gap-4 rounded-md border bg-card p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8"
      >
        <div className="max-w-xl">
          <h2 id="cta-tengah-judul" className="text-xl font-semibold">
            {CTA_TENGAH.judul}
          </h2>
          <p className="mt-1 text-muted-foreground">{CTA_TENGAH.deskripsi}</p>
        </div>
        <Button asChild size="lg" className="h-12 shrink-0 rounded-md px-6 text-base">
          <Link href={HREF_MULAI}>{CTA_TENGAH.tombol}</Link>
        </Button>
      </div>
    </section>
  );
}
