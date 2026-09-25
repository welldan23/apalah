import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ChevronLeft, CirclePause, CirclePlay, Eye } from "lucide-react";

import { FormPilot } from "@/components/platform/form-pilot";
import { StatusBadge } from "@/components/status-badge";
import { Card } from "@/components/ui/card";
import { getDb } from "@/db";
import { pastikanPlatformAdmin } from "@/lib/data/platform";
import { formatTanggal, formatWaktu } from "@/lib/format";
import { getDetailWorkspace } from "@/lib/platform/konsol";

export const metadata: Metadata = { title: "Detail workspace" };

const waktu = (d: Date) => formatWaktu(d.toISOString());

/** Support console satu workspace: status integrasi & event tersanitasi (tanpa data penyewa). */
export default async function DetailWorkspacePage({ params }: PageProps<"/platform/workspace/[id]">) {
  await connection();
  const adminUserId = await pastikanPlatformAdmin();
  const { id } = await params;
  const w = await getDetailWorkspace(await getDb(), { organizationId: decodeURIComponent(id), adminUserId });
  if (!w) notFound();

  return (
    <>
      <Link href="/platform/workspace" className="-ml-1 inline-flex min-h-11 w-fit items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" aria-hidden="true" />
        Semua workspace
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{w.namaKos}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {w.id} · {w.jumlahKamar} kamar · dibuat {formatTanggal(w.dibuatPada.toISOString().slice(0, 10))}
          </p>
        </div>
        <StatusBadge tone={w.pilot.aktif ? "success" : "warning"} icon={w.pilot.aktif ? CirclePlay : CirclePause}>
          {w.pilot.aktif ? "Pilot Kosta AI aktif" : "Pilot Kosta AI disuspend"}
        </StatusBadge>
      </header>
      <p className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
        <Eye className="size-3.5 shrink-0" aria-hidden="true" />
        Akses ke halaman ini tercatat di log admin. Data penyewa, tagihan, dan isi chat tidak ditampilkan.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="gap-3 p-4 shadow-none">
          <h2 className="font-semibold">Integrasi</h2>
          <dl className="text-sm">
            {(
              [
                ["Aksi menunggu konfirmasi", String(w.aksiMenunggu)],
                ["WA terkirim / gagal (7 hari)", `${w.kirim7Hari.terkirim} / ${w.kirim7Hari.gagal}`],
                ...(w.pilot.alasan ? ([["Alasan status pilot", w.pilot.alasan]] as const) : []),
              ] as const
            ).map(([label, nilai]) => (
              <div key={label} className="flex justify-between gap-3 border-b py-1.5">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-right font-medium">{nilai}</dd>
              </div>
            ))}
          </dl>
          <h3 className="text-sm font-medium">Nomor WhatsApp tertaut (owner/admin)</h3>
          <ul className="divide-y rounded-lg border text-sm">
            {w.pengelola.map((p, i) => (
              <li key={i} className="flex justify-between gap-3 px-3 py-2">
                <span className="min-w-0 truncate">
                  {p.nama} <span className="text-muted-foreground">· {p.peran}</span>
                </span>
                <span className="shrink-0 tabular-nums">
                  {p.nomorWa} {p.terverifikasi ? "✓" : "(belum verifikasi)"}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="gap-3 p-4 shadow-none">
          <h2 className="font-semibold">{w.pilot.aktif ? "Suspend pilot" : "Aktifkan kembali pilot"}</h2>
          <FormPilot organizationId={w.id} aktif={w.pilot.aktif} />
        </Card>
      </div>

      <Card className="gap-0 py-0 shadow-none">
        <h2 className="border-b px-4 py-3 font-semibold">Event Kosta AI terbaru</h2>
        {w.eventKosta.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Belum ada event.</p>
        ) : (
          <ul className="divide-y text-sm">
            {w.eventKosta.map((e, i) => (
              <li key={i} className="flex flex-wrap justify-between gap-x-3 px-4 py-2">
                <span>
                  <span className="font-medium">{e.intent ?? "—"}</span> <span className="text-muted-foreground">via {e.saluran}</span>
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {e.hasil}
                  {e.statusKonfirmasi ? ` · ${e.statusKonfirmasi}` : ""} · {waktu(e.waktu)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {w.galatKirim.length > 0 && (
        <Card className="gap-0 py-0 shadow-none">
          <h2 className="border-b px-4 py-3 font-semibold">Kiriman WhatsApp gagal terbaru</h2>
          <ul className="divide-y text-sm">
            {w.galatKirim.map((g, i) => (
              <li key={i} className="flex flex-col gap-0.5 px-4 py-2">
                <span className="font-medium">
                  {g.jenis} · {g.provider} <span className="font-normal text-muted-foreground">· {waktu(g.waktu)}</span>
                </span>
                <span className="text-danger">{g.galat}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
