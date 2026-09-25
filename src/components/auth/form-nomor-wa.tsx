"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { FieldError } from "@/components/quick-actions/action-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { panggilAuth } from "@/lib/auth/klien";
import { normalisasiNomorWa, tampilNomorWa } from "@/lib/nomor-wa";

/**
 * Langkah pertama daftar: nomor WhatsApp owner. Nomor dirapikan ke format 62…, kode OTP dikirim
 * lewat WhatsApp, lalu lanjut ke halaman verifikasi.
 */
export function FormNomorWa({ nomorAwal }: { /** Nomor sebelumnya, mis. saat kembali dari "Ganti nomor". */ nomorAwal?: string }) {
  const router = useRouter();
  const [nomor, setNomor] = useState(nomorAwal ? tampilNomorWa(nomorAwal) : "");
  const [galat, setGalat] = useState<string>();
  const [mengirim, setMengirim] = useState(false);

  const nomorValid = normalisasiNomorWa(nomor);

  async function kirimKode(e: React.FormEvent) {
    e.preventDefault();
    if (!nomorValid) {
      setGalat(nomor.trim() ? "Nomor WhatsApp tidak valid, contoh 0812 3456 7890." : "Isi nomor WhatsApp kamu.");
      return;
    }
    setMengirim(true);
    try {
      await panggilAuth("/phone-number/send-otp", { phoneNumber: nomorValid });
      router.push(`/daftar/verifikasi?nomor=${nomorValid}`);
    } catch (err) {
      setGalat((err as Error).message);
      setMengirim(false);
    }
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
            : "Pakai nomor yang biasa kamu pakai. Nomor ini jadi akun Kostera dan nomor untuk chat dengan Kosta AI."}
        </p>
        <FieldError id="daftar-wa-galat" pesan={galat} />
      </div>
      <Button type="submit" size="lg" className="h-12 text-base" disabled={mengirim}>
        {mengirim ? "Mengirim kode…" : "Kirim kode lewat WhatsApp"}
      </Button>
    </form>
  );
}
