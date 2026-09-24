"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck } from "lucide-react";

import { FieldError } from "@/components/quick-actions/action-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GalatAuth, KODE_OTP_HANGUS, panggilAuth } from "@/lib/auth/klien";
import { tampilNomorWa } from "@/lib/nomor-wa";
import {
  bersihkanKodeOtp,
  formatHitungMundur,
  JEDA_KIRIM_ULANG_DETIK,
  MAKS_PERCOBAAN_OTP,
  MASA_BERLAKU_OTP_MENIT,
  PANJANG_OTP,
} from "@/lib/otp";

type Status = "isi" | "memeriksa" | "berhasil";

/**
 * Isi kode OTP dari WhatsApp: dicek ke server begitu 6 digit (POST /api/auth/phone-number/verify →
 * cookie sesi), batas salah, dan kirim ulang setelah jeda.
 */
export function FormOtp({ nomorWa }: { nomorWa: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [kode, setKode] = useState("");
  const [status, setStatus] = useState<Status>("isi");
  const [galat, setGalat] = useState<string>();
  const [info, setInfo] = useState<string>();
  const [salah, setSalah] = useState(0);
  const [sisaJeda, setSisaJeda] = useState(JEDA_KIRIM_ULANG_DETIK);
  const [mengirimUlang, setMengirimUlang] = useState(false);

  useEffect(() => {
    if (sisaJeda <= 0) return;
    const t = setTimeout(() => setSisaJeda((d) => d - 1), 1000);
    return () => clearTimeout(t);
  }, [sisaJeda]);

  const terkunci = salah >= MAKS_PERCOBAAN_OTP;

  async function periksa(nilai: string) {
    if (nilai.length !== PANJANG_OTP) {
      setGalat(`Isi ${PANJANG_OTP} digit kode dari WhatsApp.`);
      return;
    }
    setStatus("memeriksa");
    setGalat(undefined);
    setInfo(undefined);
    try {
      await panggilAuth("/phone-number/verify", { phoneNumber: nomorWa, code: nilai });
      setStatus("berhasil");
      router.push("/daftar/workspace");
      return;
    } catch (err) {
      const galat = err as GalatAuth;
      setKode("");
      setStatus("isi");
      if (galat.kode === "INVALID_OTP") {
        const total = salah + 1;
        setSalah(total);
        setGalat(
          total >= MAKS_PERCOBAAN_OTP
            ? `Kode salah ${MAKS_PERCOBAAN_OTP} kali. Minta kode baru untuk mencoba lagi.`
            : `Kode salah. Sisa ${MAKS_PERCOBAAN_OTP - total} percobaan.`,
        );
      } else {
        // Kode hangus (kedaluwarsa / terlalu banyak salah) → kunci sampai minta kode baru.
        if (galat.kode && KODE_OTP_HANGUS.includes(galat.kode)) setSalah(MAKS_PERCOBAAN_OTP);
        setGalat(galat.message);
      }
    }
    // Tunggu input aktif lagi sebelum difokuskan.
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  async function kirimUlang() {
    setMengirimUlang(true);
    setGalat(undefined);
    setInfo(undefined);
    try {
      await panggilAuth("/phone-number/send-otp", { phoneNumber: nomorWa });
      setSisaJeda(JEDA_KIRIM_ULANG_DETIK);
      setSalah(0);
      setKode("");
      setInfo(`Kode baru sudah dikirim ke ${tampilNomorWa(nomorWa)}. Kode sebelumnya tidak berlaku lagi.`);
      requestAnimationFrame(() => inputRef.current?.focus());
    } catch (err) {
      setGalat((err as Error).message);
    } finally {
      setMengirimUlang(false);
    }
  }

  if (status === "berhasil") {
    return (
      <section aria-live="polite" className="flex flex-col items-center gap-3 rounded-2xl border bg-card px-4 py-8 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-success-soft text-success">
          <CircleCheck className="size-6" aria-hidden="true" />
        </span>
        <div>
          <p className="font-semibold">Nomor terverifikasi</p>
          <p className="mt-1 text-sm text-muted-foreground">Tinggal isi data kos kamu…</p>
        </div>
      </section>
    );
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void periksa(kode);
      }}
      className="flex flex-col gap-4 rounded-2xl border bg-card p-4 sm:p-6"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="kode-otp">Kode verifikasi</Label>
        <Input
          ref={inputRef}
          id="kode-otp"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          autoFocus
          placeholder={"•".repeat(PANJANG_OTP)}
          className="h-14 bg-card pl-[0.5em] text-center text-2xl font-semibold tracking-[0.5em] tabular-nums"
          value={kode}
          disabled={terkunci || status !== "isi"}
          onChange={(e) => {
            const baru = bersihkanKodeOtp(e.target.value);
            setKode(baru);
            setGalat(undefined);
            setInfo(undefined);
            if (baru.length === PANJANG_OTP) void periksa(baru);
          }}
          aria-invalid={!!galat}
          aria-describedby="kode-otp-info kode-otp-galat"
        />
        <p id="kode-otp-info" className="text-xs text-muted-foreground">
          Kode berlaku {MASA_BERLAKU_OTP_MENIT} menit. Jangan berikan kode ini ke siapa pun.
        </p>
        <FieldError id="kode-otp-galat" pesan={galat} />
        {info && (
          <p role="status" className="text-xs text-success">
            {info}
          </p>
        )}
      </div>

      <Button type="submit" size="lg" className="h-12 text-base" disabled={terkunci || status !== "isi"}>
        {status === "memeriksa" ? "Memeriksa…" : "Verifikasi"}
      </Button>

      <div className="flex min-h-11 items-center justify-center text-sm">
        {sisaJeda > 0 ? (
          <p className="text-muted-foreground" aria-live="off">
            Belum dapat kode? Kirim ulang dalam <span className="tabular-nums">{formatHitungMundur(sisaJeda)}</span>
          </p>
        ) : (
          <Button type="button" variant="ghost" size="lg" className="h-11 text-primary" disabled={mengirimUlang} onClick={kirimUlang}>
            {mengirimUlang ? "Mengirim…" : "Kirim ulang kode"}
          </Button>
        )}
      </div>
    </form>
  );
}
