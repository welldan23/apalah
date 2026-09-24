import { CircleCheck, CircleX } from "lucide-react";

import { SectionHeading } from "@/components/landing/section-heading";
import { MASALAH } from "@/lib/landing/content";

export function ProblemSection() {
  return (
    <section aria-labelledby="masalah-judul" className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
      <SectionHeading id="masalah-judul" eyebrow="Kenapa Kostera" judul={MASALAH.judul} />
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border bg-muted/60 p-5 sm:p-6">
          <h3 className="font-semibold text-muted-foreground">{MASALAH.sebelum.label}</h3>
          <ul className="mt-4 flex flex-col gap-3">
            {MASALAH.sebelum.poin.map((poin) => (
              <li key={poin} className="flex gap-2.5 text-sm text-muted-foreground">
                <CircleX className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {poin}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-primary/25 bg-card p-5 sm:p-6">
          <h3 className="font-semibold text-primary">{MASALAH.sesudah.label}</h3>
          <ul className="mt-4 flex flex-col gap-3">
            {MASALAH.sesudah.poin.map((poin) => (
              <li key={poin} className="flex gap-2.5 text-sm">
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                {poin}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
