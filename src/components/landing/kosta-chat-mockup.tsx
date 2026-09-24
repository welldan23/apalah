"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCheck, CircleCheck, Link2, RotateCcw, SendHorizontal } from "lucide-react";

import { CHAT_KOSTA, type PesanChat } from "@/lib/landing/content";
import { cn } from "@/lib/utils";

// Jeda pemutaran ulang (ms): owner mengetik lebih cepat, Kosta "mengetik" dulu.
const JEDA_OWNER = 700;
const JEDA_KOSTA_MENGETIK = 1100;

function IsiPesan({ pesan }: { pesan: PesanChat }) {
  if ("jenis" in pesan && pesan.jenis === "preview") {
    return (
      <div className="w-56">
        <p className="font-medium">{pesan.judul}</p>
        <dl className="mt-1.5 divide-y rounded-lg border bg-background/60 text-xs">
          {pesan.baris.map(([label, nilai]) => (
            <div key={label} className="flex justify-between gap-3 px-2.5 py-1.5">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-medium">{nilai}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-1.5 text-xs text-muted-foreground">Balas “Kirim” untuk mengirim.</p>
      </div>
    );
  }
  if ("jenis" in pesan && pesan.jenis === "invoice") {
    return (
      <>
        {pesan.teks}
        <span className="mt-1.5 flex w-fit items-center gap-1.5 rounded-md bg-accent px-2 py-1 text-xs font-medium text-accent-foreground">
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
          Konfirmasi bayar · {pesan.nominal}
        </span>
        <span className="mt-0.5 block">{pesan.teks}</span>
      </>
    );
  }
  return pesan.teks;
}

function Gelembung({ pesan, baru }: { pesan: PesanChat; baru: boolean }) {
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
          "max-w-[85%] rounded-2xl px-3 py-2 text-[0.8rem] leading-snug shadow-xs",
          dariOwner
            ? "rounded-br-sm bg-accent text-accent-foreground"
            : "rounded-bl-sm bg-card text-card-foreground",
        )}
      >
        <span className="sr-only">{dariOwner ? "Owner: " : "Kosta: "}</span>
        <IsiPesan pesan={pesan} />
        <span className="mt-1 flex items-center justify-end gap-1 text-[0.65rem] text-muted-foreground">
          {pesan.waktu}
          {dariOwner && (
            <CheckCheck className="size-3.5 text-primary" aria-label="Sudah dibaca" />
          )}
        </span>
      </div>
    </li>
  );
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

/** Mockup percakapan owner dengan Kosta di WhatsApp (data tiruan), bisa diputar ulang. */
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
    <figure className={cn("mx-auto w-full max-w-sm", className)}>
      <div className="overflow-hidden rounded-[2rem] border bg-muted shadow-sm">
        <div className="flex items-center gap-2.5 bg-primary px-4 py-3 text-primary-foreground">
          <span className="grid size-9 place-items-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
            K
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold">Kosta</p>
            <p className="text-xs text-primary-foreground/70">
              {mengetik ? "mengetik…" : "Asisten Kostera · Kos Melati"}
            </p>
          </div>
        </div>

        <ol
          ref={listRef}
          aria-label="Contoh percakapan dengan Kosta"
          className="flex flex-col justify-end gap-2 overflow-hidden px-3 py-4"
          style={tinggiTetap ? { height: tinggiTetap } : undefined}
        >
          <li className="mb-1 self-center rounded-md bg-card/80 px-2 py-0.5 text-[0.65rem] text-muted-foreground">
            Hari ini
          </li>
          {CHAT_KOSTA.slice(0, tampil).map((pesan, i) => (
            <Gelembung key={i} pesan={pesan} baru={tinggiTetap !== null} />
          ))}
          {mengetik && <IndikatorMengetik />}
        </ol>

        <div aria-hidden="true" className="flex items-center gap-2 border-t bg-card/70 px-3 py-2.5">
          <span className="flex-1 rounded-full bg-card px-3.5 py-2 text-xs text-muted-foreground">
            Ketik pesan
          </span>
          <span className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground">
            <SendHorizontal className="size-4" />
          </span>
        </div>
      </div>

      <figcaption className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        Contoh percakapan owner dengan Kosta
        <span aria-hidden="true">·</span>
        <button
          type="button"
          onClick={putarUlang}
          disabled={memutar}
          className="relative inline-flex items-center gap-1 rounded font-medium text-primary underline-offset-4 outline-none after:absolute after:-inset-x-2 after:-inset-y-3.5 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
        >
          <RotateCcw className="size-3.5" aria-hidden="true" />
          Putar ulang
        </button>
      </figcaption>
    </figure>
  );
}
