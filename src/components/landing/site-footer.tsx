import { KosteraLogo } from "@/components/app-shell/kostera-logo";
import { NAV_LANDING } from "@/components/landing/links";

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <KosteraLogo />
          <p className="mt-3 text-sm text-muted-foreground">
            Platform manajemen kos untuk owner dan admin: tagihan, pembayaran, dan kamar
            dalam satu tempat, dengan Kosta AI di WhatsApp.
          </p>
        </div>
        <nav aria-label="Tautan footer">
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {NAV_LANDING.map(({ href, label }) => (
              <li key={href}>
                <a
                  href={href}
                  className="-mx-2 inline-flex min-h-11 items-center px-2 text-muted-foreground hover:text-foreground md:min-h-0"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <p className="mx-auto max-w-6xl px-4 pb-8 text-xs text-muted-foreground sm:px-6">
        © 2026 Kostera
      </p>
    </footer>
  );
}
