// Workspace aktif untuk pengguna yang sedang masuk.
// Tahap frontend: stub dari data tiruan. Tahap backend: ambil dari sesi Better Auth
// (organisasi + peran) — bentuk `WorkspaceSession` tetap sama.

import { mockOrganization, mockOwner } from "@/lib/mock/kos-melati";
import type { Organization, Owner } from "@/lib/types";

export type WorkspaceSession = {
  organization: Organization;
  user: Owner;
  peran: "owner" | "admin" | "penyewa";
};

export async function getWorkspaceSession(): Promise<WorkspaceSession> {
  return { organization: mockOrganization, user: mockOwner, peran: "owner" };
}
