import Link from "next/link";
import { ArrowRight, CircleCheck } from "lucide-react";

import { KostaChatMockup } from "@/components/landing/kosta-chat-mockup";
import { HREF_MULAI } from "@/components/landing/links";
import { Button } from "@/components/ui/button";
import { HERO, INTIP_DASHBOARD } from "@/lib/landing/content";

/** Kartu kecil cuplikan dashboard di bawah CTA (layar lebar). */
function IntipDashboard() {
  const { judul, periode, metrik, persenTerkumpul } = INTIP_DASHBOARD;
  return (
    <div className="mt-10 hidden max-w-sm rounded-2xl border bg-card p-4 shadow-xs lg:block">
      <p className="text-xs text-muted-foreground">
        {judul} · {periode}
      </p>
      <dl className="mt-3 grid grid-cols-3 gap-3">
        {metrik.map(([label, nilai]) => (
          <div key={label}>
            <dt className="text-[0.7rem] text-muted-foreground">{label}</dt>
            <dd className="text-base font-semibold tracking-tight">{nilai}</dd>
          </div>
        ))}
      </dl>
      <div
        role="img"
        aria-label={`${persenTerkumpul}% tagihan bulan ini sudah terkumpul`}
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-accent"
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${persenTerkumpul}%` }} />
      </div>
      <p className="mt-1.5 text-[0.7rem] text-muted-foreground">
        {persenTerkumpul}% tagihan bulan ini terkumpul
      </p>
    </div>
  );
}

export function HeroSection() {
  return (
    <section
      aria-labelledby="hero-judul"
      className="relative overflow-hidden bg-[radial-gradient(60rem_30rem_at_70%_-10%,var(--color-accent),transparent_70%)]"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-10 pb-14 sm:px-6 sm:pt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-12 lg:pt-20 lg:pb-20">
        <div>
          <p className="text-sm font-medium text-primary">{HERO.eyebrow}</p>
          <h1
            id="hero-judul"
            className="mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-5xl"
          >
            {HERO.judul}
          </h1>
          <p className="mt-4 max-w-xl text-base text-pretty text-muted-foreground sm:text-lg">
            {HERO.deskripsi}
          </p>
          <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
            <Button asChild size="lg" className="h-11 px-5 text-base">
              <Link href={HREF_MULAI}>
                {HERO.ctaUtama}
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-11 px-5 text-base">
              <a href="#cara-kerja">{HERO.ctaKedua}</a>
            </Button>
          </div>
          <ul className="mt-6 flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-5">
            {HERO.poin.map((poin) => (
              <li key={poin} className="flex items-center gap-1.5">
                <CircleCheck className="size-4 shrink-0 text-success" aria-hidden="true" />
                {poin}
              </li>
            ))}
          </ul>
          <IntipDashboard />
        </div>

        <KostaChatMockup />
      </div>
    </section>
  );
}
