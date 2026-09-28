"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronRight, CirclePause, CirclePlay, MessageCircle } from "lucide-react";

import { KartuPreviewAksi } from "@/components/kosta/kartu-preview-aksi";
import { GalatServer, kirimAksi } from "@/components/quick-actions/action-sheet";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { KontrolKosta as DataKontrolKosta } from "@/lib/data/kontrol-kosta";
import { formatWaktu } from "@/lib/format";
import { tampilNomorWa } from "@/lib/nomor-wa";

/**
 * Kontrol Kosta di dashboard owner: Kosta di WhatsApp tetap jalur utama, kartu ini untuk memantau dan
 * menyetujui/menolak aksi yang menunggu tanpa membalas chat.
 */
export function KontrolKosta({ data }: { data: DataKontrolKosta }) {
  const router = useRouter();
  const [galat, setGalat] = useState<string | null>(null);

  async function putuskan(draftId: string, keputusan: "setuju" | "batal") {
    setGalat(null);
    try {
      await kirimAksi(`/api/kosta/draft/${draftId}`, { keputusan });
      router.refresh();
    } catch (err) {
      // Mis. draft sudah diputuskan/diganti di chat: tampilkan alasannya dan muat ulang daftarnya.
      setGalat((err as Error).message);
      router.refresh();
    }
  }

  return (
    <Card aria-labelledby="kontrol-kosta-judul" className="gap-3 p-4 shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="kontrol-kosta-judul" className="flex items-center gap-2 font-semibold">
          <MessageCircle className="size-4 text-primary" aria-hidden="true" />
          Kosta AI di WhatsApp
        </h2>
        <StatusBadge tone={data.pilot.aktif ? "success" : "warning"} icon={data.pilot.aktif ? CirclePlay : CirclePause}>
          {data.pilot.aktif ? "Aktif" : "Dinonaktifkan sementara"}
        </StatusBadge>
      </div>

      {!data.kanal.produksi && (
        <p className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          Mode {data.kanal.mode}: masih pilot/sandbox, bukan jalur tagihan produksi.
        </p>
      )}
      {!data.pilot.aktif && (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm">
          Kosta AI dinonaktifkan sementara oleh tim Kostera{data.pilot.alasan ? ` (${data.pilot.alasan})` : ""}. Dashboard tetap bisa dipakai.
        </p>
      )}

      <p className="text-sm text-muted-foreground">
        Nomor tertaut:{" "}
        <span className="font-medium text-foreground tabular-nums">{data.nomorWa ? tampilNomorWa(data.nomorWa) : "—"}</span>
        {data.nomorTerverifikasi ? " · terverifikasi" : " · belum terverifikasi"}. Chat Kosta AI dari nomor ini untuk cek tunggakan,
        kamar kosong, atau menyiapkan tagihan & reminder.
      </p>

      <section aria-labelledby="aksi-menunggu-judul" className="flex flex-col gap-2">
        <h3 id="aksi-menunggu-judul" className="text-sm font-medium">
          Menunggu persetujuanmu{data.aksiMenunggu.length ? ` (${data.aksiMenunggu.length})` : ""}
        </h3>
        {data.aksiMenunggu.length === 0 ? (
          <p className="text-sm text-muted-foreground">Tidak ada aksi yang menunggu.</p>
        ) : (
          data.aksiMenunggu.map((p) => <KartuPreviewAksi key={p.draftId} preview={p} onPutuskan={(k) => putuskan(p.draftId!, k)} />)
        )}
        <GalatServer pesan={galat} />
      </section>

      {data.riwayat.length > 0 && (
        <section aria-labelledby="riwayat-aksi-judul" className="flex flex-col gap-1">
          <h3 id="riwayat-aksi-judul" className="text-sm font-medium">
            Riwayat aksi
          </h3>
          <ul className="divide-y rounded-lg border text-sm">
            {data.riwayat.map((r, i) => (
              <li key={i} className="flex flex-wrap justify-between gap-x-3 px-3 py-2">
                <span>
                  {r.label} <span className="text-muted-foreground">· {r.hasil}</span>
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  via {r.saluran} · {formatWaktu(r.waktu)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Button asChild variant="outline" size="lg" className="h-11 self-start">
        <Link href="/kosta">
          Buka chat Kosta AI
          <ChevronRight data-icon="inline-end" />
        </Link>
      </Button>
    </Card>
  );
}
