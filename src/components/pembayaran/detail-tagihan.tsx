"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, TriangleAlert } from "lucide-react";

import { InvoiceStatusBadge, PaymentStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import type { TagihanPembayaran } from "@/lib/data/pembayaran";
import { formatPeriode, formatRupiah, formatTanggal, formatWaktu } from "@/lib/format";
import { keteranganWaktu } from "@/lib/invoice";
import { cn } from "@/lib/utils";

/** Detail satu tagihan: rincian, uang diterima & selisih, riwayat pembayaran, dan link invoice. */
export function DetailTagihan({ tagihan: t, hariIni }: { tagihan: TagihanPembayaran; hariIni: string }) {
  const [tersalin, setTersalin] = useState(false);
  const linkInvoice = `/invoice/${t.tokenPublik}`;
  const waktu = keteranganWaktu(t, hariIni);
  const selisih = t.dibayar > 0 ? t.dibayar - t.nominal : 0;

  async function salinLink() {
    try {
      await navigator.clipboard.writeText(new URL(linkInvoice, window.location.origin).href);
      setTersalin(true);
      setTimeout(() => setTersalin(false), 2000);
    } catch {
      setTersalin(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold">
            {t.nomorKamar} · {t.namaPenghuni}
          </p>
          <p className="text-sm text-muted-foreground">Tagihan {formatPeriode(t.periode)}</p>
        </div>
        <InvoiceStatusBadge status={t.status} className="shrink-0" />
      </div>

      {t.status === "perlu_review" && (
        <p className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2.5 text-sm text-warning">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Uang yang diterima {selisih < 0 ? "kurang" : "lebih"} {formatRupiah(Math.abs(selisih))}{" "}
          dari tagihan. Status tidak diubah jadi Lunas sampai kamu memeriksanya.
        </p>
      )}

      <dl className="divide-y rounded-lg border bg-card text-sm">
        {(
          [
            ["Nominal tagihan", formatRupiah(t.nominal)],
            ["Jatuh tempo", `${formatTanggal(t.jatuhTempo)} · ${waktu.teks}`],
            ["Diterbitkan", formatTanggal(t.diterbitkanPada)],
            ["Uang diterima", formatRupiah(t.dibayar)],
            ...(selisih !== 0
              ? [["Selisih", `${selisih < 0 ? "Kurang" : "Lebih"} ${formatRupiah(Math.abs(selisih))}`] as const]
              : []),
          ] as const
        ).map(([label, nilai]) => (
          <div key={label} className="flex items-start justify-between gap-4 px-3 py-2.5">
            <dt className="text-muted-foreground">{label}</dt>
            <dd
              className={cn(
                "text-right font-medium tabular-nums",
                label === "Selisih" && "text-warning",
                label === "Jatuh tempo" && waktu.telat && "text-danger",
              )}
            >
              {nilai}
            </dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="riwayat-bayar-judul">
        <h3 id="riwayat-bayar-judul" className="mb-2 text-sm font-medium">
          Riwayat pembayaran
        </h3>
        {t.riwayat.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
            Belum ada pembayaran masuk.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border bg-card text-sm">
            {t.riwayat.map((p) => (
              <li key={p.id} className="flex flex-col gap-1 px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium tabular-nums">{formatRupiah(p.nominal)}</span>
                  <PaymentStatusBadge status={p.status} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {p.metode} · {p.provider} · {p.waktu ? formatWaktu(p.waktu) : "belum diverifikasi"}
                </p>
                <p className="truncate font-mono text-[0.7rem] text-muted-foreground">Ref: {p.referensi}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex gap-2">
        <Button asChild variant="outline" size="lg" className="h-11 flex-1">
          <a href={linkInvoice} target="_blank" rel="noopener noreferrer">
            <ExternalLink data-icon="inline-start" />
            Buka invoice
          </a>
        </Button>
        <Button variant="outline" size="lg" className="h-11 flex-1" onClick={salinLink}>
          {tersalin ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
          {tersalin ? "Tersalin" : "Salin link"}
        </Button>
      </div>
    </div>
  );
}
