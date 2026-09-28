import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { CirclePause, CirclePlay, Search } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getDb } from "@/db";
import { pastikanPlatformAdmin } from "@/lib/data/platform";
import { formatTanggal } from "@/lib/format";
import { cariWorkspace } from "@/lib/platform/konsol";

export const metadata: Metadata = { title: "Workspace" };

/** Cari workspace (kos) berdasarkan ID atau nama untuk support. */
export default async function CariWorkspacePage({ searchParams }: PageProps<"/platform/workspace">) {
  await connection();
  await pastikanPlatformAdmin();
  const { q } = await searchParams;
  const kata = typeof q === "string" ? q : "";
  const hasil = await cariWorkspace(await getDb(), kata);

  return (
    <>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Workspace</h1>
        <p className="mt-1 text-sm text-muted-foreground">Cari berdasarkan ID atau nama kos. Membuka detail tercatat di log admin.</p>
      </header>
      <form className="flex gap-2" role="search">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={kata} aria-label="ID atau nama kos" placeholder="ID atau nama kos" className="h-11 bg-card pl-9" />
        </div>
        <Button type="submit" size="lg" className="h-11">
          Cari
        </Button>
      </form>
      <Card className="gap-0 py-0 shadow-none">
        {hasil.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">Tidak ada workspace yang cocok.</p>
        ) : (
          <ul className="divide-y">
            {hasil.map((w) => (
              <li key={w.id}>
                <Link href={`/platform/workspace/${encodeURIComponent(w.id)}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/50">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{w.namaKos}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {w.id} · {w.jumlahKamar} kamar · dibuat {formatTanggal(w.dibuatPada.toISOString().slice(0, 10))}
                    </span>
                  </span>
                  <StatusBadge tone={w.pilotAktif ? "success" : "warning"} icon={w.pilotAktif ? CirclePlay : CirclePause} className="shrink-0">
                    {w.pilotAktif ? "Pilot aktif" : "Disuspend"}
                  </StatusBadge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
