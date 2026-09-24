"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";

import { CatatanSimulasi, FieldError } from "@/components/quick-actions/action-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalisasiNomorWa, tampilNomorWa } from "@/lib/nomor-wa";

/**
 * Langkah pertama daftar: nomor WhatsApp owner. Nomor dirapikan ke format 62… lalu kode OTP dikirim ke sana.
 * Tahap frontend: pengiriman kode masih contoh.
 */
export function FormNomorWa() {
  const [nomor, setNomor] = useState("");
  const [galat, setGalat] = useState<string>();
  const [terkirimKe, setTerkirimKe] = useState<string>();

  const nomorValid = normalisasiNomorWa(nomor);

  function kirimKode(e: React.FormEvent) {
    e.preventDefault();
    if (!nomorValid) {
      setGalat(nomor.trim() ? "Nomor WhatsApp tidak valid, contoh 0812 3456 7890." : "Isi nomor WhatsApp kamu.");
      return;
    }
    setTerkirimKe(nomorValid);
  }

  if (terkirimKe) {
    return (
      <section aria-live="polite" className="flex flex-col items-center gap-3 rounded-2xl border bg-card px-4 py-8 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-success-soft text-success">
          <MessageCircle className="size-6" aria-hidden="true" />
        </span>
        <div>
          <p className="font-semibold">Cek WhatsApp kamu</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Kode verifikasi dikirim ke <span className="font-medium text-foreground tabular-nums">{tampilNomorWa(terkirimKe)}</span>.
          </p>
        </div>
        <CatatanSimulasi>Mode contoh: kode belum benar-benar dikirim.</CatatanSimulasi>
        <Button variant="ghost" size="lg" className="h-11" onClick={() => setTerkirimKe(undefined)}>
          Ganti nomor
        </Button>
      </section>
    );
  }

  return (
    <form noValidate onSubmit={kirimKode} className="flex flex-col gap-4 rounded-2xl border bg-card p-4 sm:p-6">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="daftar-wa">Nomor WhatsApp</Label>
        <Input
          id="daftar-wa"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          autoFocus
          className="h-12 bg-card text-base"
          placeholder="0812 3456 7890"
          value={nomor}
          onChange={(e) => {
            setGalat(undefined);
            setNomor(e.target.value);
          }}
          aria-invalid={!!galat}
          aria-describedby="daftar-wa-info daftar-wa-galat"
        />
        <p id="daftar-wa-info" className="text-xs text-muted-foreground">
          {nomorValid
            ? `Kode dikirim ke ${tampilNomorWa(nomorValid)}.`
            : "Pakai nomor yang biasa kamu pakai. Nomor ini jadi akun Kostera dan nomor untuk chat dengan Kosta."}
        </p>
        <FieldError id="daftar-wa-galat" pesan={galat} />
      </div>
      <Button type="submit" size="lg" className="h-12 text-base">
        Kirim kode lewat WhatsApp
      </Button>
    </form>
  );
}
