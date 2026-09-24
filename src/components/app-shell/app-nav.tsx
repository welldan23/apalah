"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV_ITEMS } from "@/components/app-shell/nav-items";
import { cn } from "@/lib/utils";

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

/** Navigasi vertikal di sidebar desktop. */
export function SidebarNav() {
  const isActive = useIsActive();

  return (
    <nav aria-label="Navigasi utama" className="flex flex-col gap-0.5">
      {NAV_ITEMS.map(({ href, label, icon: Icon, siap }) => {
        const active = isActive(href);
        const kelas = cn(
          "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium transition-colors",
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
        );

        if (!siap) {
          return (
            <span
              key={href}
              aria-disabled="true"
              className={cn(kelas, "cursor-default text-sidebar-foreground/45 hover:bg-transparent hover:text-sidebar-foreground/45")}
            >
              <Icon className="size-4" />
              <span className="flex-1">{label}</span>
              <span className="rounded-full border border-sidebar-border px-1.5 text-[0.65rem] font-medium">
                Segera
              </span>
            </span>
          );
        }

        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={kelas}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Bottom nav mobile (disembunyikan di layar lebar). */
export function MobileNav() {
  const isActive = useIsActive();

  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {NAV_ITEMS.filter((item) => item.mobile).map(
          ({ href, labelPendek, icon: Icon, siap }) => {
            const active = isActive(href);
            const isi = (
              <>
                <Icon className="size-5" strokeWidth={active ? 2.25 : 1.75} />
                <span className="text-[0.7rem] leading-none">{labelPendek}</span>
              </>
            );
            const kelas =
              "flex h-16 flex-col items-center justify-center gap-1.5 font-medium";

            return (
              <li key={href}>
                {siap ? (
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      kelas,
                      active ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {isi}
                  </Link>
                ) : (
                  <span
                    aria-disabled="true"
                    title="Segera hadir"
                    className={cn(kelas, "text-muted-foreground/45")}
                  >
                    {isi}
                  </span>
                )}
              </li>
            );
          },
        )}
      </ul>
    </nav>
  );
}
