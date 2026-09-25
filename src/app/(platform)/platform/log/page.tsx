import type { Metadata } from "next";
import { connection } from "next/server";

import { Card } from "@/components/ui/card";
import { getDb } from "@/db";
import { pastikanPlatformAdmin } from "@/lib/data/platform";
import { formatWaktu } from "@/lib/format";
import { getLogPlatform } from "@/lib/platform/konsol";

export const metadata: Metadata = { title: "Log admin" };

const LABEL: Record<string, string> = {
  lihat_workspace: "Membuka detail workspace",
  suspend_pilot: "Suspend pilot Kosta AI",
  resume_pilot: "Aktifkan kembali pilot Kosta AI",
  tambah_admin: "Menambah platform admin",
  hapus_admin: "Menghapus platform admin",
};

/** Log setiap akses & perubahan oleh platform admin (100 terbaru). */
export default async function LogPlatformPage() {
  await connection();
  await pastikanPlatformAdmin();
  const log = await getLogPlatform(await getDb());
  return (
    <>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Log admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">Setiap akses dan perubahan oleh platform admin tercatat di sini dan tidak bisa diedit dari konsol.</p>
      </header>
      <Card className="gap-0 py-0 shadow-none">
        {log.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">Belum ada log.</p>
        ) : (
          <ul className="divide-y text-sm">
            {log.map((l, i) => (
              <li key={i} className="flex flex-col gap-0.5 px-4 py-2.5">
                <span className="font-medium">
                  {LABEL[l.aksi] ?? l.aksi}
                  {l.namaKos ? ` — ${l.namaKos}` : ""}
                </span>
                <span className="text-xs text-muted-foreground">
                  {l.admin ?? "skrip server"} · {formatWaktu(l.waktu.toISOString())}
                  {typeof l.detail.alasan === "string" ? ` · alasan: ${l.detail.alasan}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
