import { CircleCheck } from "lucide-react";

import { SectionHeading } from "@/components/landing/section-heading";
import { CARA_KERJA } from "@/lib/landing/content";

export function HowItWorksSection() {
  return (
    <section
      id="cara-kerja"
      aria-labelledby="cara-kerja-judul"
      className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:px-6 sm:py-20"
    >
      <SectionHeading
        id="cara-kerja-judul"
        eyebrow="Cara kerja"
        judul="Siapkan sekali, lalu cukup lewat chat"
      />
      <ol className="mt-8 grid md:grid-cols-3 md:gap-6">
        {CARA_KERJA.map(({ icon: Icon, judul, deskripsi, hasil }, i) => {
          const terakhir = i === CARA_KERJA.length - 1;
          return (
            <li key={judul} className="relative flex gap-4 pb-6 last:pb-0 md:flex-col md:gap-4 md:pb-0">
              {/* Garis penghubung: vertikal di mobile, horizontal di layar lebar. */}
              {!terakhir && (
                <span
                  aria-hidden="true"
                  className="absolute top-10 bottom-0 left-4 w-px bg-border md:top-4 md:right-[-1.5rem] md:bottom-auto md:left-12 md:h-px md:w-auto"
                />
              )}
              <span className="relative grid size-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground ring-4 ring-background">
                <span className="sr-only">Langkah </span>
                {i + 1}
              </span>
              <div className="flex-1 rounded-2xl border bg-card p-5">
                <Icon className="size-5 text-primary" aria-hidden="true" />
                <h3 className="mt-3 font-semibold">{judul}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{deskripsi}</p>
                <p className="mt-4 flex items-start gap-1.5 border-t pt-3 text-xs font-medium text-success">
                  <CircleCheck className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                  {hasil}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
