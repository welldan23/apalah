import Link from "next/link";

import { KosteraLogo } from "@/components/app-shell/kostera-logo";
import { HREF_MASUK, HREF_MULAI, NAV_LANDING } from "@/components/landing/links";
import { Button } from "@/components/ui/button";
import { CTA_PENUTUP } from "@/lib/landing/content";

/** Footer penutup: satu kalimat besar + satu tombol, lalu baris kecil wordmark · tautan · hak cipta. */
export function SiteFooter() {
  return (
    <footer aria-labelledby="penutup-judul" className="border-t-2 border-foreground bg-card">
      <div className="mx-auto max-w-6xl px-4 pt-16 pb-8 sm:px-6 sm:pt-24">
        <h2 id="penutup-judul" className="max-w-[18ch] text-4xl leading-[1.02] font-semibold tracking-[-0.03em] sm:text-6xl">
          {CTA_PENUTUP.judul}
        </h2>
        <p className="mt-5 max-w-lg text-lg text-pretty text-muted-foreground">{CTA_PENUTUP.deskripsi}</p>
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Button asChild size="lg" className="h-12 rounded-md px-6 text-base whitespace-nowrap">
            <Link href={HREF_MULAI}>{CTA_PENUTUP.tombol}</Link>
          </Button>
          <Link
            href={HREF_MASUK}
            className="inline-flex min-h-11 items-center font-medium whitespace-nowrap underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground"
          >
            Sudah punya akun? Masuk
          </Link>
        </div>

        <div className="mt-20 flex flex-col gap-4 border-t pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <KosteraLogo />
          <nav aria-label="Tautan footer">
            <ul className="flex flex-wrap items-center gap-x-6 gap-y-1">
              {NAV_LANDING.map(({ href, label }) => (
                <li key={href}>
                  <a href={href} className="inline-flex min-h-11 items-center whitespace-nowrap hover:text-foreground">
                    {label}
                  </a>
                </li>
              ))}
              <li>© 2026 Kostera</li>
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
