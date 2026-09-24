"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { SendHorizontal } from "lucide-react";

import { BubblePesan } from "@/components/kosta/bubble-pesan";
import { formatTanggal } from "@/lib/format";
import { tampilNomorWa } from "@/lib/nomor-wa";
import type { PesanKosta } from "@/lib/types";
import { tanggalWib } from "@/lib/waktu";

const JEDA_BALASAN = 1100;

const BALASAN_CONTOH =
  "Mode contoh: Kosta belum tersambung ke layanan AI. Setelah aktif, pertanyaanmu dijawab dengan angka langsung dari database kos.";

function labelTanggal(tanggal: string, hariIni: string) {
  return tanggal === hariIni ? "Hari ini" : formatTanggal(tanggal);
}

function IndikatorMengetik() {
  return (
    <li className="flex justify-start" aria-label="Kosta sedang mengetik">
      <span className="flex gap-1 rounded-2xl rounded-bl-sm bg-card px-3 py-3 shadow-xs">
        {[0, 150, 300].map((jeda) => (
          <span
            key={jeda}
            className="size-1.5 rounded-full bg-muted-foreground/60 motion-safe:animate-bounce"
            style={{ animationDelay: `${jeda}ms` }}
          />
        ))}
      </span>
    </li>
  );
}

/** Panel chat owner dengan Kosta — isi sama dengan percakapan di WhatsApp. */
export function ChatKosta({
  hariIni,
  namaKos,
  nomorWa,
  pesan: awal,
}: {
  hariIni: string;
  namaKos: string;
  nomorWa: string;
  pesan: PesanKosta[];
}) {
  const [pesan, setPesan] = useState(awal);
  const [draf, setDraf] = useState("");
  const [mengetik, setMengetik] = useState(false);
  const bawahRef = useRef<HTMLLIElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);
  // Selalu tampilkan pesan terbaru.
  useEffect(() => {
    bawahRef.current?.scrollIntoView({ block: "end" });
  }, [pesan.length, mengetik]);

  function kirim(e: React.FormEvent) {
    e.preventDefault();
    const teks = draf.trim();
    if (!teks || mengetik) return;
    setPesan((p) => [
      ...p,
      { id: crypto.randomUUID(), dari: "owner", waktu: new Date().toISOString(), teks },
    ]);
    setDraf("");
    setMengetik(true);
    timer.current = setTimeout(() => {
      setMengetik(false);
      setPesan((p) => [
        ...p,
        { id: crypto.randomUUID(), dari: "kosta", waktu: new Date().toISOString(), teks: BALASAN_CONTOH },
      ]);
    }, JEDA_BALASAN);
  }

  // Kelompokkan per tanggal WIB untuk pemisah "Hari ini" / tanggal.
  const grup: { tanggal: string; pesan: PesanKosta[] }[] = [];
  for (const p of pesan) {
    const tanggal = tanggalWib(new Date(p.waktu));
    const terakhir = grup.at(-1);
    if (terakhir?.tanggal === tanggal) terakhir.pesan.push(p);
    else grup.push({ tanggal, pesan: [p] });
  }

  return (
    <section
      aria-labelledby="kosta-judul"
      className="flex h-[calc(100dvh-15.5rem)] min-h-96 flex-col overflow-hidden rounded-2xl border bg-muted lg:h-[calc(100dvh-11rem)]"
    >
      <header className="flex items-center gap-3 bg-primary px-4 py-3 text-primary-foreground">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent font-semibold text-accent-foreground">
          K
        </span>
        <div className="min-w-0 leading-tight">
          <h2 id="kosta-judul" className="font-semibold">
            Kosta
          </h2>
          <p className="truncate text-xs text-primary-foreground/75">
            {mengetik ? "mengetik…" : `${namaKos} · WhatsApp ${tampilNomorWa(nomorWa)}`}
          </p>
        </div>
      </header>

      <ol
        aria-label="Percakapan dengan Kosta"
        aria-live="polite"
        className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 py-4 sm:px-5"
      >
        {grup.map(({ tanggal, pesan }) => (
          <Fragment key={tanggal}>
            <li className="my-1 self-center rounded-md bg-card/80 px-2 py-0.5 text-xs text-muted-foreground">
              <time dateTime={tanggal}>{labelTanggal(tanggal, hariIni)}</time>
            </li>
            {pesan.map((p) => (
              <BubblePesan key={p.id} pesan={p} />
            ))}
          </Fragment>
        ))}
        {mengetik && <IndikatorMengetik />}
        <li ref={bawahRef} aria-hidden="true" />
      </ol>

      <form onSubmit={kirim} className="flex items-center gap-2 border-t bg-card/80 px-3 py-2.5">
        <label htmlFor="kosta-pesan" className="sr-only">
          Tulis pesan untuk Kosta
        </label>
        <input
          id="kosta-pesan"
          autoComplete="off"
          placeholder="Tanya Kosta…"
          className="h-11 min-w-0 flex-1 rounded-full border border-input bg-card px-4 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:text-sm"
          value={draf}
          onChange={(e) => setDraf(e.target.value)}
        />
        <button
          type="submit"
          aria-label="Kirim pesan"
          disabled={!draf.trim() || mengetik}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-opacity outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
        >
          <SendHorizontal className="size-5" />
        </button>
      </form>
    </section>
  );
}
