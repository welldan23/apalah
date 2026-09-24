"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, ChevronRight, CircleCheck, Plus } from "lucide-react";

import { GalatServer, kirimAksi } from "@/components/quick-actions/action-sheet";
import { StatusBadge } from "@/components/status-badge";
import type { WorkspaceRingkas } from "@/lib/types";
import { cn } from "@/lib/utils";

const LABEL_PERAN: Record<WorkspaceRingkas["peran"], string> = { owner: "Pemilik", admin: "Admin", penyewa: "Penyewa" };

/** Daftar kos yang bisa dikelola; memilih satu menyimpannya di sesi lalu membuka dashboard kos itu. */
export function PilihWorkspace({ workspaces, aktifId }: { workspaces: WorkspaceRingkas[]; aktifId: string | null }) {
  const router = useRouter();
  const [memilih, setMemilih] = useState<string>();
  const [galat, setGalat] = useState<string | null>(null);

  async function pilih(id: string) {
    setMemilih(id);
    setGalat(null);
    try {
      await kirimAksi("/api/akun/workspace-aktif", { organizationId: id });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setGalat((err as Error).message);
      setMemilih(undefined);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2.5">
        {workspaces.map((ws) => {
          const aktif = ws.id === aktifId;
          return (
            <li key={ws.id}>
              <button
                type="button"
                onClick={() => pilih(ws.id)}
                disabled={memilih !== undefined}
                aria-current={aktif ? "true" : undefined}
                className={cn(
                  "flex min-h-16 w-full items-center gap-3 rounded-2xl border bg-card p-3.5 text-left transition-colors outline-none hover:border-primary/40 hover:bg-accent/30 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60",
                  aktif && "border-primary/50",
                  memilih === ws.id && "border-primary bg-accent/40 disabled:opacity-100",
                )}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
                  <Building2 className="size-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{ws.namaKos}</span>
                  <span className="block text-sm text-muted-foreground">
                    {ws.jumlahKamar} kamar · {LABEL_PERAN[ws.peran]}
                  </span>
                </span>
                {memilih === ws.id ? (
                  <span className="shrink-0 text-sm text-muted-foreground">Membuka…</span>
                ) : aktif ? (
                  <StatusBadge tone="success" icon={CircleCheck} className="shrink-0">
                    Sedang dibuka
                  </StatusBadge>
                ) : (
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <Link
        href="/kamar/tambah"
        className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-dashed text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
      >
        <Plus className="size-4" aria-hidden="true" />
        Daftarkan kos baru
      </Link>

      <GalatServer pesan={galat} />
    </div>
  );
}
