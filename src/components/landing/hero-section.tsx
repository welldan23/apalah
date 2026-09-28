import Link from "next/link";

import { KostaChatMockup } from "@/components/landing/kosta-chat-mockup";
import { HREF_MULAI } from "@/components/landing/links";
import { Button } from "@/components/ui/button";
import { HERO } from "@/lib/landing/content";

export function HeroSection() {
  return (
    <section aria-labelledby="hero-judul" className="border-b">
      {/* Split diptych: judul & ajakan di kiri, percakapan Kosta AI di kanan. Padding bawah > atas
          supaya hero menyambung ke seksi alur di bawahnya. */}
      <div className="mx-auto grid max-w-6xl gap-12 px-4 pt-8 pb-16 sm:px-6 sm:pt-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-16 lg:pt-12 lg:pb-24">
        <div className="lg:pt-6">
          <h1
            id="hero-judul"
            className="max-w-xl text-[2.6rem] leading-[1.02] font-semibold tracking-[-0.03em] sm:text-6xl"
          >
            {HERO.judul}
          </h1>
          <p className="mt-6 max-w-lg text-lg text-pretty text-muted-foreground">{HERO.deskripsi}</p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Button asChild size="lg" className="h-12 rounded-md px-6 text-base whitespace-nowrap">
              <Link href={HREF_MULAI}>{HERO.ctaUtama}</Link>
            </Button>
            <a
              href="#cara-kerja"
              className="inline-flex min-h-11 items-center text-base font-medium whitespace-nowrap underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground"
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
