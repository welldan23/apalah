import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";

// Landing adalah halaman publik tanpa login: selalu dirender statis saat build.
// "error" membuat build gagal bila ada komponen di sini yang membaca cookies/headers
// (mis. sesi login) — jadi landing tidak mungkin menampilkan data kos mana pun.
export const dynamic = "error";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a
        href="#konten"
        className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Lewati ke konten
      </a>
      <SiteHeader />
      <main id="konten" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
