import { ChevronDown } from "lucide-react";

import { SectionHeading } from "@/components/landing/section-heading";
import { FAQ } from "@/lib/landing/content";

export function FaqSection() {
  return (
    <section id="faq" aria-labelledby="faq-judul" className="scroll-mt-20 border-t bg-card/60">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1fr_1.6fr]">
        <SectionHeading
          id="faq-judul"
          eyebrow="FAQ"
          judul="Pertanyaan yang sering muncul"
        />
        <div className="divide-y rounded-2xl border bg-background">
          {FAQ.map(({ tanya, jawab }) => (
            <details key={tanya} className="group px-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-medium [&::-webkit-details-marker]:hidden">
                {tanya}
                <ChevronDown
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                />
              </summary>
              <p className="pb-4 text-sm text-muted-foreground">{jawab}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
