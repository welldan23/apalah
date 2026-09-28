"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCheck, CircleCheck, Link2, RotateCcw } from "lucide-react";

import { CHAT_KOSTA, type PesanChat } from "@/lib/landing/content";
import { cn } from "@/lib/utils";

// Percakapan ditampilkan apa adanya (warna gelembung WhatsApp lewat token --wa-*), tanpa menggambar
// ulang bingkai aplikasi — header kontak & kolom ketik palsu sengaja tidak ada.
// Jeda pemutaran ulang (ms): owner mengetik lebih cepat, Kosta "mengetik" dulu.
const JEDA_OWNER = 700;
const JEDA_KOSTA_MENGETIK = 1100;

function IsiPesan({ pesan }: { pesan: PesanChat }) {
  if ("jenis" in pesan && pesan.jenis === "preview") {
    return (
      <div className="w-56">
        <p className="font-semibold">{pesan.judul}</p>
        <dl className="mt-1.5 divide-y divide-wa-tinta/10 rounded-md border border-wa-tinta/10 bg-wa-lembar text-xs">
          {pesan.baris.map(([label, nilai]) => (
            <div key={label} className="flex justify-between gap-3 px-2.5 py-1.5">
              <dt className="text-wa-meta">{label}</dt>
              <dd className="font-medium">{nilai}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-1.5 text-xs text-wa-meta">{pesan.catatan}</p>
      </div>
    );
  }
  if ("jenis" in pesan && pesan.jenis === "invoice") {
    return (
      <>
        {pesan.teks}
        <span className="mt-1.5 flex w-fit items-center gap-1.5 rounded-md bg-wa-bar px-2 py-1 text-xs font-medium text-wa-tautan">
          <Link2 className="size-3.5" aria-hidden="true" />
          {pesan.link}
        </span>
      </>
    );
  }
  if ("jenis" in pesan && pesan.jenis === "lunas") {
    return (
      <>
        <span className="flex items-center gap-1.5 font-medium text-success">
          <CircleCheck className="size-4" aria-hidden="true" />
          Lunas · {pesan.nominal}
        </span>
        <span className="mt-0.5 block">{pesan.teks}</span>
      </>
    );
  }
  return pesan.teks;
}

/** Satu gelembung chat bergaya WhatsApp (juga dipakai cuplikan di tahap-tahap alur landing). */
export function Gelembung({ pesan, baru = false }: { pesan: PesanChat; baru?: boolean }) {
  const dariOwner = pesan.dari === "owner";
  return (
    <li
      className={cn(
        "flex",
        dariOwner ? "justify-end" : "justify-start",
        baru && "animate-in duration-300 fade-in slide-in-from-bottom-2",
      )}
    >
      <div
        className={cn(
          "bayangan-wa max-w-[85%] rounded-lg px-2.5 py-1.5 text-[0.82rem] leading-snug text-wa-tinta",
          dariOwner ? "rounded-tr-none bg-wa-keluar" : "rounded-tl-none bg-wa-masuk",
        )}
      >
        <span className="sr-only">{dariOwner ? "Owner: " : "Kosta AI: "}</span>
        <IsiPesan pesan={pesan} />
        <span className="mt-0.5 flex items-center justify-end gap-1 text-[0.65rem] text-wa-meta">
          {pesan.waktu}
          {dariOwner && <CheckCheck className="size-3.5 text-wa-centang" aria-label="Sudah dibaca" />}
        </span>
      </div>
    </li>
  );
}

function IndikatorMengetik() {
  return (
    <li className="flex justify-start" aria-label="Kosta AI sedang mengetik">
      <span className="bayangan-wa flex gap-1 rounded-lg rounded-tl-none bg-wa-masuk px-3 py-3">
        {[0, 150, 300].map((jeda) => (
          <span
            key={jeda}
            className="size-1.5 rounded-full bg-wa-meta/70 motion-safe:animate-bounce"
            style={{ animationDelay: `${jeda}ms` }}
          />
        ))}
      </span>
    </li>
  );
}

/** Percakapan owner dengan Kosta AI di WhatsApp (data tiruan), bisa diputar ulang. */
export function KostaChatMockup({ className }: { className?: string }) {
  // Default menampilkan seluruh percakapan (juga saat render server).
  const [tampil, setTampil] = useState(CHAT_KOSTA.length);
  const [mengetik, setMengetik] = useState(false);
  const [tinggiTetap, setTinggiTetap] = useState<number | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const memutar = tampil < CHAT_KOSTA.length;

  const hentikan = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => hentikan, []);

  function putarUlang() {
    hentikan();
    // Kunci tinggi area chat supaya layout halaman tidak loncat selama pemutaran.
    setTinggiTetap(listRef.current?.offsetHeight ?? null);
    setTampil(0);
    setMengetik(false);

    let waktu = 400;
    CHAT_KOSTA.forEach((pesan, i) => {
      if (pesan.dari === "kosta") {
        timers.current.push(setTimeout(() => setMengetik(true), waktu));
        waktu += JEDA_KOSTA_MENGETIK;
      } else {
        waktu += JEDA_OWNER;
      }
      timers.current.push(
        setTimeout(() => {
          setMengetik(false);
          setTampil(i + 1);
        }, waktu),
      );
    });
    timers.current.push(setTimeout(() => setTinggiTetap(null), waktu + 400));
  }

  return (
    <figure className={cn("mx-auto w-full max-w-sm lg:mr-0", className)}>
      <p className="mb-2 flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">Chat Kosta AI · Kos Melati</span>
        <span className="text-muted-foreground">{mengetik ? "mengetik…" : "WhatsApp"}</span>
      </p>
      <ol
        ref={listRef}
        aria-label="Contoh percakapan dengan Kosta AI"
        className="flex flex-col justify-end gap-2 overflow-hidden rounded-md border bg-wa-wallpaper px-3 py-4"
        style={tinggiTetap ? { height: tinggiTetap } : undefined}
      >
        {CHAT_KOSTA.slice(0, tampil).map((pesan, i) => (
          <Gelembung key={i} pesan={pesan} baru={tinggiTetap !== null} />
        ))}
        {mengetik && <IndikatorMengetik />}
      </ol>

      <figcaption className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        Contoh percakapan owner dengan Kosta AI
        <button
          type="button"
          onClick={putarUlang}
          disabled={memutar}
          className="relative inline-flex shrink-0 items-center gap-1 rounded font-medium whitespace-nowrap text-foreground underline decoration-foreground/30 underline-offset-4 outline-none after:absolute after:-inset-x-2 after:-inset-y-3.5 hover:decoration-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55"
        >
          <RotateCcw className="size-3.5" aria-hidden="true" />
          Putar ulang
        </button>
      </figcaption>
    </figure>
  );
}
