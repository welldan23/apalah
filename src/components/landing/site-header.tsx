import Link from "next/link";

import { KosteraLogo } from "@/components/app-shell/kostera-logo";
import { HREF_MASUK, HREF_MULAI } from "@/components/landing/links";

// Landing punya dua tujuan nyata — masuk atau daftar — jadi nav cukup wordmark + dua tautan teks
// (tanpa deretan menu, tanpa tombol berisi, tanpa menu hamburger).
export function SiteHeader() {
  return (
    <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:h-20 sm:px-6">
      <Link href="/" aria-label="Kostera, ke beranda" className="flex min-h-11 items-center">
        <KosteraLogo />
      </Link>
      <nav aria-label="Akun">
        <ul className="flex items-center gap-5 text-sm sm:gap-7 sm:text-base">
          <li>
            <Link href={HREF_MASUK} className="inline-flex min-h-11 items-center whitespace-nowrap text-muted-foreground hover:text-foreground">
              Masuk
            </Link>
          </li>
          <li>
            <Link
              href={HREF_MULAI}
              className="inline-flex min-h-11 items-center font-semibold whitespace-nowrap underline decoration-2 underline-offset-[6px] hover:decoration-primary"
            >
              Daftar gratis
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
