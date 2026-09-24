"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, CircleCheck } from "lucide-react";

import { FieldError, GalatServer, kirimAksi } from "@/components/quick-actions/action-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAKS_KAMAR_AWAL, periksaDataKos, type GalatDataKos } from "@/lib/daftar-kos";
import { tampilNomorWa } from "@/lib/nomor-wa";

type Workspace = { namaPemilik: string; namaKos: string; jumlahKamar: number };

/**
 * Langkah terakhir daftar: data kos pertama → workspace (organisasi + owner + jadwal pengingat)
 * dibuat otomatis lewat POST /api/akun/workspace; nomor WhatsApp yang baru diverifikasi sudah tertaut.
 */
export function FormWorkspace({ nomorWa }: { nomorWa: string }) {
  const [namaPemilik, setNamaPemilik] = useState("");
  const [namaKos, setNamaKos] = useState("");
  const [jumlahKamar, setJumlahKamar] = useState("");
  const [galat, setGalat] = useState<GalatDataKos>({});
  const [siap, setSiap] = useState<Workspace>();
  const [membuat, setMembuat] = useState(false);
  const [galatServer, setGalatServer] = useState<string | null>(null);

  const bersihkan = (kunci: keyof GalatDataKos) => setGalat((g) => (g[kunci] ? { ...g, [kunci]: undefined } : g));

  async function buat(e: React.FormEvent) {
    e.preventDefault();
    const data = { namaPemilik, namaKos, jumlahKamar: jumlahKamar ? Number(jumlahKamar) : Number.NaN };
    const g = periksaDataKos(data);
    setGalat(g);
    if (Object.keys(g).length > 0) return;
    setMembuat(true);
    setGalatServer(null);
    try {
      await kirimAksi("/api/akun/workspace", data);
      setSiap({ namaPemilik: namaPemilik.trim(), namaKos: namaKos.trim(), jumlahKamar: data.jumlahKamar });
    } catch (err) {
      setGalatServer((err as Error).message);
    } finally {
      setMembuat(false);
    }
  }

  if (siap) {
    const hasil = [
      { judul: `Workspace ${siap.namaKos} dibuat`, ket: `${siap.namaPemilik} tercatat sebagai pemilik.` },
      { judul: `Nomor ${tampilNomorWa(nomorWa)} tertaut`, ket: "Dipakai untuk masuk dan chat dengan Kosta di WhatsApp." },
      { judul: `${siap.jumlahKamar} kamar tercatat`, ket: "Lengkapi nomor, tipe, dan harga kamar kapan saja." },
    ];
    return (
      <section aria-live="polite" className="flex flex-col gap-5 rounded-2xl border bg-card p-4 sm:p-6">
        <div className="flex flex-col items-center gap-3 pt-2 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-success-soft text-success">
            <CircleCheck className="size-6" aria-hidden="true" />
          </span>
          <p className="text-lg font-semibold">Kos kamu siap dikelola</p>
        </div>
        <ul className="flex flex-col gap-3">
          {hasil.map(({ judul, ket }) => (
            <li key={judul} className="flex gap-3 text-sm">
              <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
              <div className="min-w-0">
                <p className="font-medium break-words">{judul}</p>
                <p className="text-muted-foreground">{ket}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-2">
          <Button asChild size="lg" className="h-12 text-base">
            <Link href="/dashboard">Buka dashboard</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-11">
            <Link href="/kamar/tambah">Lengkapi data kamar</Link>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <form noValidate onSubmit={buat} className="flex flex-col gap-4 rounded-2xl border bg-card p-4 sm:p-6">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ws-nama">Nama kamu</Label>
        <Input
          id="ws-nama"
          autoComplete="name"
          autoFocus
          className="h-11 bg-card text-base"
          placeholder="mis. Ratna Wijayanti"
          value={namaPemilik}
          onChange={(e) => {
            bersihkan("namaPemilik");
            setNamaPemilik(e.target.value);
          }}
          aria-invalid={!!galat.namaPemilik}
          aria-describedby="ws-nama-galat"
        />
        <FieldError id="ws-nama-galat" pesan={galat.namaPemilik} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ws-kos">Nama kos</Label>
        <Input
          id="ws-kos"
          autoComplete="organization"
          className="h-11 bg-card text-base"
          placeholder="mis. Kos Melati"
          value={namaKos}
          onChange={(e) => {
            bersihkan("namaKos");
            setNamaKos(e.target.value);
          }}
          aria-invalid={!!galat.namaKos}
          aria-describedby="ws-kos-galat"
        />
        <FieldError id="ws-kos-galat" pesan={galat.namaKos} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ws-kamar">Jumlah kamar</Label>
        <Input
          id="ws-kamar"
          inputMode="numeric"
          autoComplete="off"
          className="h-11 bg-card text-base tabular-nums"
          placeholder="mis. 40"
          value={jumlahKamar}
          onChange={(e) => {
            bersihkan("jumlahKamar");
            setJumlahKamar(e.target.value.replace(/\D/g, "").slice(0, 4));
          }}
          aria-invalid={!!galat.jumlahKamar}
          aria-describedby="ws-kamar-info ws-kamar-galat"
        />
        <p id="ws-kamar-info" className="text-xs text-muted-foreground">
          Semua kamar di kos ini, terisi maupun kosong (maks. {MAKS_KAMAR_AWAL}).
        </p>
        <FieldError id="ws-kamar-galat" pesan={galat.jumlahKamar} />
      </div>

      <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
        Nomor WhatsApp <span className="font-medium whitespace-nowrap text-foreground">{tampilNomorWa(nomorWa)}</span> sudah
        terverifikasi dan akan langsung tertaut ke workspace ini.
      </p>

      <GalatServer pesan={galatServer} />
      <Button type="submit" size="lg" className="h-12 text-base" disabled={membuat}>
        {membuat ? "Menyiapkan workspace…" : "Buat workspace"}
      </Button>
    </form>
  );
}
