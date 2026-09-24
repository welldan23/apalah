import Link from "next/link";

import { MobileNav, SidebarNav } from "@/components/app-shell/app-nav";
import { KosteraLogo } from "@/components/app-shell/kostera-logo";
import { UserAvatar } from "@/components/app-shell/user-avatar";
import { WorkspaceBadge } from "@/components/app-shell/workspace-badge";
import type { WorkspaceSession } from "@/lib/data/session";

const LABEL_PERAN: Record<WorkspaceSession["peran"], string> = {
  owner: "Pemilik",
  admin: "Admin",
  penyewa: "Penyewa",
};

export function AppShell({
  session,
  children,
}: {
  session: WorkspaceSession;
  children: React.ReactNode;
}) {
  const { organization, user, peran } = session;

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-5 border-r bg-sidebar px-3 py-5 lg:flex">
        <Link href="/dashboard" className="px-2">
          <KosteraLogo />
        </Link>
        <WorkspaceBadge organization={organization} />
        <SidebarNav />
        <div className="mt-auto flex items-center gap-2.5 rounded-lg px-2 py-1.5">
          <UserAvatar nama={user.nama} />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-medium">{user.nama}</p>
            <p className="text-xs text-muted-foreground">{LABEL_PERAN[peran]}</p>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b bg-background/90 px-4 backdrop-blur lg:hidden">
          <Link href="/dashboard">
            <KosteraLogo />
          </Link>
          <div className="flex min-w-0 items-center gap-2">
            <WorkspaceBadge organization={organization} compact />
            <UserAvatar nama={user.nama} />
          </div>
        </header>

        <main className="flex-1 px-4 pt-5 pb-24 sm:px-6 lg:px-8 lg:pt-8 lg:pb-12">
          {children}
        </main>
      </div>

      <MobileNav />
    </div>
  );
}
