import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { KosteraLogo } from "@/components/app-shell/kostera-logo";
import { TombolKeluar } from "@/components/auth/tombol-keluar";
import { pastikanPlatformAdmin } from "@/lib/data/platform";

export const metadata: Metadata = {
  title: { default: "Konsol Platform", template: "%s · Konsol Platform" },
  robots: { index: false, follow: false },
};

const MENU = [
  { href: "/platform", label: "Ringkasan" },
  { href: "/platform/workspace", label: "Workspace" },
  { href: "/platform/log", label: "Log admin" },
];

// Konsol operator Kostera — terpisah dari aplikasi owner kos. Non-admin mendapat 404.
export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  await pastikanPlatformAdmin();
  return (
    <>
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <div className="flex items-center gap-2">
            <KosteraLogo />
            <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              Konsol platform
            </span>
          </div>
          <nav aria-label="Konsol platform" className="flex flex-1 gap-1 overflow-x-auto text-sm">
            {MENU.map((m) => (
              <Link key={m.href} href={m.href} className="rounded-md px-3 py-2 font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
                {m.label}
              </Link>
            ))}
          </nav>
          <TombolKeluar />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 py-6">{children}</main>
    </>
  );
}
