import Link from "next/link";

import { KosteraLogo } from "@/components/app-shell/kostera-logo";
import { HREF_MASUK, HREF_MULAI, NAV_LANDING } from "@/components/landing/links";
import { MobileMenu } from "@/components/landing/mobile-menu";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
        <div className="flex items-center gap-8">
          <Link href="/" aria-label="Kostera, ke beranda" className="flex min-h-11 items-center">
            <KosteraLogo />
          </Link>
          <nav aria-label="Navigasi halaman" className="hidden md:block">
            <ul className="flex items-center gap-6">
              {NAV_LANDING.map(({ href, label }) => (
                <li key={href}>
                  <a href={href} className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="flex items-center gap-1.5">
          <Button asChild variant="ghost" size="lg" className="hidden md:inline-flex">
            <Link href={HREF_MASUK}>Masuk</Link>
          </Button>
          <Button asChild size="lg" className="relative rounded-md after:absolute after:inset-x-0 after:-inset-y-1.5">
            <Link href={HREF_MULAI}>Mulai gratis</Link>
          </Button>
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
