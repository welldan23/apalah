"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Clock, Copy, Landmark, QrCode } from "lucide-react";

import { CatatanSimulasi } from "@/components/quick-actions/action-sheet";
import { Button } from "@/components/ui/button";
import { formatRupiah, formatWaktu } from "@/lib/format";
import {
  cariMetode,
  formatNomorVa,
  formatSisaWaktu,
  langkahBayar,
  METODE_BAYAR,
  type IdMetodeBayar,
  type InstruksiBayar,
} from "@/lib/pembayaran/metode";
import { cn } from "@/lib/utils";

/**
 * Tahap frontend: instruksi contoh (nomor VA/QR belum asli). Tahap backend: POST
 * /api/invoice/[token]/bayar { metode } → InstruksiBayar dari payment gateway.
 */
function instruksiContoh(metode: IdMetodeBayar, nominal: number): InstruksiBayar {
  const m = cariMetode(metode)!;
  const kedaluwarsaPada = new Date(Date.now() + m.masaBerlakuMenit * 60_000).toISOString();
  return m.jenis === "qris"
    ? { metode, nominal, kedaluwarsaPada, qrString: "CONTOH" }
    : { metode, nominal, kedaluwarsaPada, nomorVa: "8808000012345678" };
}

/** Bayar tagihan lewat tautan: pilih metode → instruksi QRIS / Virtual Account dengan batas waktu. */
export function PembayaranTagihan({ token, nominal }: { token: string; nominal: number }) {
  const [pilihan, setPilihan] = useState<IdMetodeBayar>("qris");
  const [instruksi, setInstruksi] = useState<InstruksiBayar | null>(null);

  if (instruksi) {
    return <InstruksiPembayaran token={token} instruksi={instruksi} onGantiMetode={() => setInstruksi(null)} />;
  }

  return (
    <section aria-labelledby="metode-judul" className="flex flex-col gap-4 rounded-2xl border bg-card p-5">
      <h2 id="metode-judul" className="font-semibold">
        Pilih cara bayar
      </h2>
      <div role="radiogroup" aria-labelledby="metode-judul" className="flex flex-col gap-2">
        {METODE_BAYAR.map((m) => {
          const aktif = pilihan === m.id;
          const Ikon = m.jenis === "qris" ? QrCode : Landmark;
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={aktif}
              onClick={() => setPilihan(m.id)}
              className={cn(
                "flex min-h-14 items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                aktif ? "border-primary bg-accent/40" : "hover:border-primary/40",
              )}
            >
              <Ikon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-medium">
                  {m.label}
                  {m.jenis === "qris" && (
                    <span className="rounded-full bg-success-soft px-2 py-0.5 text-[0.7rem] font-medium text-success">
                      Paling cepat
                    </span>
                  )}
                </span>
                <span className="block text-xs text-muted-foreground">{m.keterangan}</span>
              </span>
              <span
                aria-hidden="true"
                className={cn("size-4 shrink-0 rounded-full border-2", aktif ? "border-[5px] border-primary" : "border-input")}
              />
            </button>
          );
        })}
      </div>
      <Button size="lg" className="h-12 text-base" onClick={() => setInstruksi(instruksiContoh(pilihan, nominal))}>
        Bayar {formatRupiah(nominal)}
      </Button>
    </section>
  );
}

function InstruksiPembayaran({
  token,
  instruksi,
  onGantiMetode,
}: {
  token: string;
  instruksi: InstruksiBayar;
  onGantiMetode: () => void;
}) {
  const metode = cariMetode(instruksi.metode)!;
  const [sisaMs, setSisaMs] = useState(() => new Date(instruksi.kedaluwarsaPada).getTime() - Date.now());
  const [tersalin, setTersalin] = useState(false);
  const kedaluwarsa = sisaMs <= 0;

  useEffect(() => {
    const batas = new Date(instruksi.kedaluwarsaPada).getTime();
    const t = setInterval(() => setSisaMs(batas - Date.now()), 1000);
    return () => clearInterval(t);
  }, [instruksi.kedaluwarsaPada]);

  async function salin() {
    if (!instruksi.nomorVa) return;
    try {
      await navigator.clipboard.writeText(instruksi.nomorVa);
      setTersalin(true);
      setTimeout(() => setTersalin(false), 2000);
    } catch {
      // Clipboard tidak tersedia (mis. bukan HTTPS) — nomor tetap bisa dipilih manual.
    }
  }

  return (
    <section aria-labelledby="instruksi-judul" className="flex flex-col gap-4 rounded-2xl border bg-card p-5">
      <div>
        <h2 id="instruksi-judul" className="font-semibold">
          {metode.label}
        </h2>
        <p className="text-3xl font-semibold tracking-tight tabular-nums">{formatRupiah(instruksi.nominal)}</p>
        <p
          aria-live="polite"
          className={cn("mt-1 flex items-center gap-1.5 text-sm", kedaluwarsa ? "text-danger" : "text-muted-foreground")}
        >
          <Clock className="size-4 shrink-0" aria-hidden="true" />
          {kedaluwarsa
            ? "Waktu bayar habis. Pilih cara bayar lagi untuk membuat instruksi baru."
            : `Bayar sebelum ${formatWaktu(instruksi.kedaluwarsaPada)} · sisa ${formatSisaWaktu(sisaMs)}`}
        </p>
      </div>

      {!kedaluwarsa &&
        (metode.jenis === "qris" ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border bg-white p-4">
            <div
              role="img"
              aria-label="Kode QR pembayaran"
              className="grid size-52 place-items-center rounded-lg border-2 border-dashed text-muted-foreground"
            >
              <QrCode className="size-24" aria-hidden="true" />
            </div>
            <p className="text-xs text-muted-foreground">Scan dengan aplikasi apa pun yang mendukung QRIS</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 rounded-xl border bg-muted/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Nomor Virtual Account</p>
              <p className="text-xl font-semibold whitespace-nowrap tabular-nums select-all">
                {formatNomorVa(instruksi.nomorVa ?? "")}
              </p>
            </div>
            <Button variant="outline" size="lg" className="h-11 shrink-0 bg-card" onClick={salin}>
              {tersalin ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
              {tersalin ? "Tersalin" : "Salin"}
            </Button>
          </div>
        ))}

      {!kedaluwarsa && (
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm">
          {langkahBayar(metode, formatRupiah(instruksi.nominal)).map((langkah) => (
            <li key={langkah}>{langkah}</li>
          ))}
        </ol>
      )}

      <p className="text-sm text-muted-foreground">
        Sudah bayar? Status tagihan berubah jadi Lunas otomatis begitu pembayaran diterima — tidak perlu kirim bukti
        transfer.
      </p>
      <div className="flex flex-col gap-2">
        <Button asChild size="lg" className="h-11">
          <Link href={`/invoice/${token}`}>Cek status tagihan</Link>
        </Button>
        <Button variant="ghost" size="lg" className="h-11" onClick={onGantiMetode}>
          Ganti cara bayar
        </Button>
      </div>
      <CatatanSimulasi>Mode contoh: nomor Virtual Account dan kode QR ini belum asli — jangan dibayar.</CatatanSimulasi>
    </section>
  );
}
