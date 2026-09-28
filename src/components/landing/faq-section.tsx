import { Plus } from "lucide-react";

import { SectionHeading } from "@/components/landing/section-heading";
import { FAQ } from "@/lib/landing/content";

export function FaqSection() {
  return (
    <section id="faq" aria-labelledby="faq-judul" className="scroll-mt-20 border-t">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1fr_1.5fr] lg:gap-16">
        <SectionHeading id="faq-judul" judul="Pertanyaan yang sering muncul" className="lg:sticky lg:top-24 lg:self-start" />
        <div className="border-t-2 border-foreground">
          {/* name yang sama: membuka satu pertanyaan menutup yang lain, supaya halaman tidak memanjang di ponsel. */}
          {FAQ.map(({ tanya, jawab }) => (
            <details key={tanya} name="faq" className="group border-b">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 py-4 text-lg font-medium [&::-webkit-details-marker]:hidden">
                {tanya}
                <Plus
                  aria-hidden="true"
                  className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-45"
                />
              </summary>
              <p className="max-w-prose pb-5 text-pretty text-muted-foreground">{jawab}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
