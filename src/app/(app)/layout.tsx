import { AppShell } from "@/components/app-shell/app-shell";
import { getWorkspaceSession } from "@/lib/data/session";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getWorkspaceSession();
  return <AppShell session={session}>{children}</AppShell>;
}
