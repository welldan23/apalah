"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, CircleCheck, Clock, Copy, Eye, Landmark, LoaderCircle, QrCode } from "lucide-react";

import { CatatanSimulasi } from "@/components/quick-actions/action-sheet";
import { Button } from "@/components/ui/button";
import type { PembayaranPublik } from "@/lib/data/invoice-publik";
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
import { JEDA_CEK_STATUS_MS, statusAkhir, statusKonfirmasi, type StatusKonfirmasi } from "@/lib/pembayaran/status-bayar";
import { cn } from "@/lib/utils";

/** Keadaan tagihan saat halaman bayar dibuka — acuan mendeteksi pembayaran baru. */
type KeadaanAwal = { sudahDiterima: number; pembayaran: Pick<PembayaranPublik, "status">[] };

/** Balasan POST /api/invoice/[token]/bayar. */
type InstruksiTransaksi = InstruksiBayar & { simulasi: boolean };

/**
 * Bayar tagihan lewat tautan: pilih metode → instruksi QRIS / Virtual Account dengan batas waktu →
 * status dicek otomatis sampai pembayaran diterima (Lunas) atau perlu diperiksa pemilik kos.
 */
export function PembayaranTagihan({
  token,
  nominal,
  nomorInvoice,
  awal,
}: {
  token: string;
  nominal: number;
  nomorInvoice: string;
  awal: KeadaanAwal;
}) {
  const [pilihan, setPilihan] = useState<IdMetodeBayar>("qris");
  const [instruksi, setInstruksi] = useState<InstruksiTransaksi | null>(null);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  // Transaksi dibuat di payment gateway; memilih metode yang sama lagi memakai transaksi yang masih berlaku.
  async function bayar() {
    setMemuat(true);
    setGalat(null);
    try {
      const res = await fetch(`/api/invoice/${token}/bayar`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ metode: pilihan }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) setInstruksi(data);
      else setGalat(data?.galat ?? "Instruksi bayar belum bisa dibuat. Coba lagi.");
    } catch {
      setGalat("Koneksi terputus. Periksa internet kamu, lalu coba lagi.");
    } finally {
      setMemuat(false);
    }
  }

  if (instruksi) {
    return (
      <InstruksiPembayaran
        token={token}
        nomorInvoice={nomorInvoice}
        awal={awal}
        instruksi={instruksi}
        onGantiMetode={() => setInstruksi(null)}
      />
    );
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
      {galat && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {galat}
        </p>
      )}
      <Button size="lg" className="h-12 text-base" disabled={memuat} onClick={bayar}>
        {memuat ? "Menyiapkan instruksi…" : `Bayar ${formatRupiah(nominal)}`}
      </Button>
    </section>
  );
}

function InstruksiPembayaran({
  token,
  nomorInvoice,
  awal,
  instruksi,
  onGantiMetode,
}: {
  token: string;
  nomorInvoice: string;
  awal: KeadaanAwal;
  instruksi: InstruksiTransaksi;
  onGantiMetode: () => void;
}) {
  const metode = cariMetode(instruksi.metode)!;
  const [sisaMs, setSisaMs] = useState(() => new Date(instruksi.kedaluwarsaPada).getTime() - Date.now());
  const [tersalin, setTersalin] = useState(false);
  const [status, setStatus] = useState<StatusKonfirmasi>("menunggu");
  const [mengecek, setMengecek] = useState(false);
  const kedaluwarsa = sisaMs <= 0;

  const cekStatus = useCallback(async () => {
    setMengecek(true);
    try {
      const res = await fetch(`/api/invoice/${token}`, { cache: "no-store" });
      if (res.ok) setStatus(statusKonfirmasi(awal, await res.json()));
    } catch {
      // Koneksi putus sebentar — dicoba lagi di putaran berikutnya.
    } finally {
      setMengecek(false);
    }
  }, [token, awal]);

  // Cek otomatis sampai statusnya final (lunas / diperiksa).
  useEffect(() => {
    if (statusAkhir(status)) return;
    const t = setInterval(cekStatus, JEDA_CEK_STATUS_MS);
    return () => clearInterval(t);
  }, [status, cekStatus]);

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

  if (statusAkhir(status)) {
    return <KonfirmasiPembayaran token={token} nomorInvoice={nomorInvoice} status={status} />;
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
            <KodeQr isi={instruksi.qrString ?? ""} />
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

      <p
        role="status"
        className={cn(
          "flex items-start gap-2 rounded-lg px-3 py-2 text-sm",
          status === "diproses" ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        <LoaderCircle className="mt-0.5 size-4 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        {status === "diproses"
          ? "Pembayaran terdeteksi, sedang diproses bank/e-wallet. Halaman ini akan berubah sendiri begitu selesai."
          : "Menunggu pembayaran — dicek otomatis. Tidak perlu kirim bukti transfer; status jadi Lunas sendiri begitu uang diterima."}
      </p>
      <div className="flex flex-col gap-2">
        <Button size="lg" className="h-11" disabled={mengecek} onClick={cekStatus}>
          {mengecek ? "Mengecek…" : "Cek sekarang"}
        </Button>
        <Button variant="ghost" size="lg" className="h-11" onClick={onGantiMetode}>
          Ganti cara bayar
        </Button>
      </div>
      {instruksi.simulasi && (
        <CatatanSimulasi>Mode contoh: nomor Virtual Account dan kode QR ini belum asli — jangan dibayar.</CatatanSimulasi>
      )}
    </section>
  );
}

/** Gambar kode QR dari isi QRIS (dibuat di browser; pustaka QR baru dimuat saat dibutuhkan). */
function KodeQr({ isi }: { isi: string }) {
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let batal = false;
    import("qrcode")
      .then((qr) => qr.toString(isi, { type: "svg", margin: 1, errorCorrectionLevel: "M" }))
      .then((hasil) => !batal && setSvg(hasil))
      .catch(() => !batal && setSvg(null));
    return () => {
      batal = true;
    };
  }, [isi]);

  return (
    <div role="img" aria-label="Kode QR pembayaran" className="grid size-56 place-items-center">
      {svg ? (
        <span className="block size-full [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <QrCode className="size-24 text-muted-foreground" aria-hidden="true" />
      )}
    </div>
  );
}

/** Layar akhir: pembayaran diterima (Lunas) atau masuk tapi nominalnya perlu diperiksa pemilik kos. */
function KonfirmasiPembayaran({
  token,
  nomorInvoice,
  status,
}: {
  token: string;
  nomorInvoice: string;
  status: Extract<StatusKonfirmasi, "lunas" | "diperiksa">;
}) {
  const lunas = status === "lunas";
  return (
    <section aria-live="polite" className="flex flex-col items-center gap-4 rounded-2xl border bg-card px-5 py-8 text-center">
      <span
        className={cn(
          "grid size-14 place-items-center rounded-full",
          lunas ? "bg-success-soft text-success" : "bg-warning-soft text-warning",
        )}
      >
        {lunas ? <CircleCheck className="size-7" aria-hidden="true" /> : <Eye className="size-7" aria-hidden="true" />}
      </span>
      <div>
        <h2 className="text-lg font-semibold">{lunas ? "Pembayaran diterima" : "Pembayaran masuk, sedang diperiksa"}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {lunas
            ? `Tagihan ${nomorInvoice} sudah Lunas. Terima kasih! Konfirmasi juga dikirim ke WhatsApp kamu.`
            : "Nominal yang masuk belum sama dengan tagihan. Pemilik kos akan memeriksanya dan menghubungimu bila perlu."}
        </p>
      </div>
      <Button asChild size="lg" className="h-11 w-full">
        <Link href={`/invoice/${token}`}>{lunas ? "Lihat bukti pembayaran" : "Lihat rincian tagihan"}</Link>
      </Button>
    </section>
  );
}
