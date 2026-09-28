import Link from "next/link";

import { KostaChatMockup } from "@/components/landing/kosta-chat-mockup";
import { HREF_MULAI } from "@/components/landing/links";
import { Button } from "@/components/ui/button";
import { HERO } from "@/lib/landing/content";

export function HeroSection() {
  return (
    <section aria-labelledby="hero-judul" className="border-b">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 pt-12 pb-16 sm:px-6 sm:pt-16 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:pt-20 lg:pb-24">
        <div className="lg:pt-6">
          <h1
            id="hero-judul"
            className="max-w-xl text-[2.6rem] leading-[1.02] font-semibold tracking-[-0.03em] sm:text-6xl"
          >
            {HERO.judul}
          </h1>
          <p className="mt-6 max-w-lg text-lg text-pretty text-muted-foreground">{HERO.deskripsi}</p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Button asChild size="lg" className="h-12 rounded-md px-6 text-base">
              <Link href={HREF_MULAI}>{HERO.ctaUtama}</Link>
            </Button>
            <a
              href="#cara-kerja"
              className="text-base font-medium underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground"
            >
              {HERO.ctaKedua}
            </a>
          </div>
          <p className="mt-10 max-w-md border-t pt-4 text-sm text-muted-foreground">{HERO.poin.join(" · ")}.</p>
        </div>

        <KostaChatMockup />
      </div>
    </section>
  );
}
