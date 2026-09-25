"use client";

import { useState } from "react";
import Link from "next/link";
import { CircleCheck } from "lucide-react";

import { FieldError } from "@/components/quick-actions/action-sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  KATEGORI_TIKET,
  labelKategori,
  PANJANG_DESKRIPSI,
  periksaTiket,
  type GalatTiket,
  type TiketPenyewa,
} from "@/lib/tiket";
import { cn } from "@/lib/utils";

/** Penyewa mengirim keluhan / permintaan perbaikan ke pemilik kos lewat tautan invoice (tanpa login). */
export function FormTiket({ token, namaKos }: { token: string; namaKos: string }) {
  const [kategori, setKategori] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [galat, setGalat] = useState<GalatTiket>({});
  const [galatServer, setGalatServer] = useState<string | null>(null);
  const [mengirim, setMengirim] = useState(false);
  const [terkirim, setTerkirim] = useState<TiketPenyewa | null>(null);

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    const g = periksaTiket({ kategori, deskripsi });
    setGalat(g);
    setGalatServer(null);
    if (Object.keys(g).length > 0) return;
    setMengirim(true);
    try {
      const res = await fetch(`/api/invoice/${token}/tiket`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kategori, deskripsi }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) setTerkirim(data.tiket);
      else setGalatServer(data?.galat ?? "Tiket belum terkirim. Coba lagi.");
    } catch {
      setGalatServer("Koneksi terputus. Periksa internet kamu, lalu coba lagi.");
    } finally {
      setMengirim(false);
    }
  }

  if (terkirim) {
    return (
      <section aria-live="polite" className="flex flex-col items-center gap-4 rounded-2xl border bg-card px-5 py-8 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-success-soft text-success">
          <CircleCheck className="size-7" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-lg font-semibold">Tiket {terkirim.nomor} terkirim</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Laporan {labelKategori(terkirim.kategori).toLowerCase()} kamu sudah diteruskan ke pemilik {namaKos} dengan
            status Baru. Kabar tindak lanjutnya dikirim lewat WhatsApp.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2">
          <Button asChild size="lg" className="h-11">
            <Link href={`/invoice/${token}/tiket/status`}>Lihat status tiket</Link>
          </Button>
          <Button asChild variant="ghost" size="lg" className="h-11">
            <Link href={`/invoice/${token}`}>Kembali ke tagihan</Link>
          </Button>
        </div>
      </section>
    );
  }

  const sisaKarakter = PANJANG_DESKRIPSI.maks - deskripsi.trim().length;

  return (
    <form noValidate onSubmit={kirim} className="flex flex-col gap-5 rounded-2xl border bg-card p-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Jenis masalah</legend>
        <div role="radiogroup" aria-describedby="tiket-kategori-galat" className="grid gap-2 sm:grid-cols-2">
          {KATEGORI_TIKET.map((k) => {
            const aktif = kategori === k.id;
            return (
              <button
                key={k.id}
                type="button"
                role="radio"
                aria-checked={aktif}
                onClick={() => {
                  setKategori(k.id);
                  setGalat((g) => ({ ...g, kategori: undefined }));
                }}
                className={cn(
                  "flex min-h-14 flex-col justify-center rounded-xl border px-3 py-2 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  aktif ? "border-primary bg-accent/40" : "hover:border-primary/40",
                )}
              >
                <span className="text-sm font-medium">{k.label}</span>
                <span className="text-xs text-muted-foreground">{k.contoh}</span>
              </button>
            );
          })}
        </div>
        <FieldError id="tiket-kategori-galat" pesan={galat.kategori} />
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tiket-deskripsi">Ceritakan masalahnya</Label>
        <textarea
          id="tiket-deskripsi"
          rows={5}
          maxLength={PANJANG_DESKRIPSI.maks + 50}
          className="min-h-32 w-full rounded-lg border border-input bg-card px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
          placeholder="mis. Keran kamar mandi bocor sejak kemarin malam, lantai jadi basah terus."
          value={deskripsi}
          onChange={(e) => {
            setDeskripsi(e.target.value);
            setGalat((g) => ({ ...g, deskripsi: undefined }));
          }}
          aria-invalid={!!galat.deskripsi}
          aria-describedby="tiket-deskripsi-info tiket-deskripsi-galat"
        />
        <p id="tiket-deskripsi-info" className="flex justify-between gap-3 text-xs text-muted-foreground">
          <span>Sebutkan lokasinya dan sejak kapan, supaya cepat ditangani.</span>
          <span className={cn("shrink-0 tabular-nums", sisaKarakter < 0 && "text-danger")}>{sisaKarakter}</span>
        </p>
        <FieldError id="tiket-deskripsi-galat" pesan={galat.deskripsi} />
      </div>

      {galatServer && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {galatServer}
        </p>
      )}
      <Button type="submit" size="lg" className="h-12 text-base" disabled={mengirim}>
        {mengirim ? "Mengirim…" : "Kirim tiket"}
      </Button>
    </form>
  );
}
