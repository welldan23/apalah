"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleCheck, Copy, ExternalLink, Send, TriangleAlert } from "lucide-react";

import { GalatServer, kirimAksi } from "@/components/quick-actions/action-sheet";
import { InvoiceStatusBadge, PaymentStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import type { TagihanPembayaran } from "@/lib/data/pembayaran";
import { formatPeriode, formatRupiah, formatTanggal, formatWaktu } from "@/lib/format";
import { keteranganWaktu } from "@/lib/invoice";
import { cn } from "@/lib/utils";

type Aksi = "kirim" | "diperiksa";

const AKSI: Record<Aksi, { tombol: string; konfirmasi: (t: TagihanPembayaran) => string; ikon: typeof Send }> = {
  kirim: {
    tombol: "Kirim ke WhatsApp",
    konfirmasi: (t) =>
      `Kirim tagihan ${formatRupiah(t.nominal)} beserta link invoice ke WhatsApp ${t.namaPenghuni} (kamar ${t.nomorKamar})?`,
    ikon: Send,
  },
  diperiksa: {
    tombol: "Selesai diperiksa",
    konfirmasi: () =>
      "Tagihan kembali Menunggu pembayaran (atau Jatuh tempo bila tanggalnya sudah lewat). Pembayaran yang tidak cocok tetap tercatat di riwayat.",
    ikon: CircleCheck,
  },
};

/** Aksi owner untuk satu tagihan, selalu lewat konfirmasi: kirim ke penyewa atau tandai sudah diperiksa. */
function AksiTagihan({ t }: { t: TagihanPembayaran }) {
  const router = useRouter();
  const aksi: Aksi | null =
    t.status === "perlu_review" ? "diperiksa" : ["draft", "menunggu", "terkirim"].includes(t.status) ? "kirim" : null;
  const [langkah, setLangkah] = useState<"awal" | "konfirmasi" | "menyimpan" | "selesai">("awal");
  const [pesan, setPesan] = useState("");
  const [galat, setGalat] = useState<string | null>(null);
  if (!aksi) return null;
  const { tombol, konfirmasi, ikon: Ikon } = AKSI[aksi];

  async function jalankan() {
    setLangkah("menyimpan");
    setGalat(null);
    try {
      if (aksi === "kirim") {
        const hasil = await kirimAksi<{ terkirim: number; simulasi: boolean }>(
          "/api/dashboard/aksi/kirim-tagihan",
          { invoiceIds: [t.id] },
        );
        if (hasil.terkirim === 0) throw new Error("Pesan gagal terkirim. Periksa nomor WhatsApp penyewa lalu coba lagi.");
        setPesan(
          `Tagihan terkirim ke WhatsApp ${t.namaPenghuni}.${hasil.simulasi ? " (Mode pengembangan: pesan hanya dicatat, belum benar-benar dikirim.)" : ""}`,
        );
      } else {
        await kirimAksi("/api/dashboard/aksi/status-tagihan", { invoiceIds: [t.id], status: "menunggu" });
        setPesan("Tagihan ditandai sudah diperiksa.");
      }
      setLangkah("selesai");
      router.refresh();
    } catch (err) {
      setGalat((err as Error).message);
      setLangkah("konfirmasi");
    }
  }

  if (langkah === "selesai") {
    return (
      <p role="status" className="flex items-start gap-2 rounded-lg bg-success-soft px-3 py-2.5 text-sm text-success">
        <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {pesan}
      </p>
    );
  }

  if (langkah === "awal") {
    return (
      <Button size="lg" className="h-11" onClick={() => setLangkah("konfirmasi")}>
        <Ikon data-icon="inline-start" />
        {tombol}
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/50 p-3">
      <p className="text-sm">{konfirmasi(t)}</p>
      <GalatServer pesan={galat} />
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" size="lg" className="h-11" disabled={langkah === "menyimpan"} onClick={() => setLangkah("awal")}>
          Batal
        </Button>
        <Button size="lg" className="h-11" disabled={langkah === "menyimpan"} onClick={jalankan}>
          <Ikon data-icon="inline-start" />
          {langkah === "menyimpan" ? "Memproses…" : aksi === "kirim" ? "Kirim" : "Ya, sudah"}
        </Button>
      </div>
    </div>
  );
}

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

      <AksiTagihan t={t} />

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
