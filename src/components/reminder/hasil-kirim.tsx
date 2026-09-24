"use client";

import Link from "next/link";
import { CircleAlert, CircleCheck, RotateCcw } from "lucide-react";

import { CatatanSimulasi, GalatServer, SheetActions, SheetBody } from "@/components/quick-actions/action-sheet";
import { Button } from "@/components/ui/button";
import { SheetClose } from "@/components/ui/sheet";
import type { InvoiceRow } from "@/lib/types";
import { cn } from "@/lib/utils";

export type HasilKirimReminder = { terkirim: number; gagal: string[]; simulasi: boolean };

/** Ringkasan setelah reminder massal dikirim: terkirim vs gagal, kirim ulang yang gagal. */
export function HasilKirim({
  hasil,
  penerima,
  onKirimUlang,
  mengirimUlang,
  galat,
}: {
  hasil: HasilKirimReminder;
  /** Tagihan yang dikirimi pada pengiriman ini. */
  penerima: InvoiceRow[];
  onKirimUlang: (invoiceIds: string[]) => void;
  mengirimUlang: boolean;
  galat: string | null;
}) {
  const gagal = penerima.filter((inv) => hasil.gagal.includes(inv.nomorKamar));
  const semuaBerhasil = gagal.length === 0;

  return (
    <>
      <SheetBody>
        <div className="flex flex-col items-center gap-2 py-2 text-center">
          <span
            className={cn(
              "grid size-12 place-items-center rounded-full",
              semuaBerhasil ? "bg-success-soft text-success" : "bg-warning-soft text-warning",
            )}
          >
            {semuaBerhasil ? <CircleCheck className="size-6" /> : <CircleAlert className="size-6" />}
          </span>
          <p className="text-base font-semibold">
            Terkirim ke {hasil.terkirim} dari {penerima.length} penyewa
          </p>
          <p className="text-sm text-muted-foreground">
            Semua tercatat di riwayat reminder. Status tagihan berubah otomatis begitu pembayaran masuk.
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-success-soft px-3 py-2.5 text-success">
            <dt className="text-xs">Terkirim</dt>
            <dd className="text-2xl font-semibold tabular-nums">{hasil.terkirim}</dd>
          </div>
          <div className={cn("rounded-lg px-3 py-2.5", gagal.length ? "bg-danger-soft text-danger" : "bg-muted text-muted-foreground")}>
            <dt className="text-xs">Gagal</dt>
            <dd className="text-2xl font-semibold tabular-nums">{gagal.length}</dd>
          </div>
        </dl>

        {gagal.length > 0 && (
          <section aria-labelledby="gagal-judul" className="flex flex-col gap-2">
            <h3 id="gagal-judul" className="text-sm font-medium">
              Belum sampai
            </h3>
            <ul className="divide-y rounded-lg border bg-card text-sm">
              {gagal.map((inv) => (
                <li key={inv.id} className="flex items-center gap-3 px-3 py-2">
                  <span className="w-9 shrink-0 font-medium tabular-nums">{inv.nomorKamar}</span>
                  <span className="min-w-0 flex-1 truncate">{inv.namaPenghuni}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Biasanya karena nomor WhatsApp tidak aktif atau salah. Cek nomornya di data penghuni, lalu kirim ulang.
            </p>
            <GalatServer pesan={galat} />
          </section>
        )}

        {hasil.simulasi && (
          <CatatanSimulasi>Mode pengembangan: provider WhatsApp belum disambungkan, pesan hanya dicatat di log server.</CatatanSimulasi>
        )}
        <Link href="/reminder" className="self-center text-sm font-medium text-primary hover:underline">
          Lihat riwayat reminder
        </Link>
      </SheetBody>
      <SheetActions>
        {gagal.length > 0 ? (
          <>
            <SheetClose asChild>
              <Button size="lg" variant="outline">
                Selesai
              </Button>
            </SheetClose>
            <Button size="lg" disabled={mengirimUlang} onClick={() => onKirimUlang(gagal.map((inv) => inv.id))}>
              <RotateCcw data-icon="inline-start" />
              {mengirimUlang ? "Mengirim ulang…" : `Kirim ulang (${gagal.length})`}
            </Button>
          </>
        ) : (
          <SheetClose asChild>
            <Button size="lg">Selesai</Button>
          </SheetClose>
        )}
      </SheetActions>
    </>
  );
}
