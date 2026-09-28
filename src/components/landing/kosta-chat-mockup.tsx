"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCheck, CircleCheck, Link2, RotateCcw, SendHorizontal } from "lucide-react";

import { CHAT_KOSTA, type PesanChat } from "@/lib/landing/content";
import { cn } from "@/lib/utils";

// Tampilannya meniru WhatsApp (latar, gelembung, centang) supaya terbaca sebagai chat sungguhan.
// Jeda pemutaran ulang (ms): owner mengetik lebih cepat, Kosta "mengetik" dulu.
const JEDA_OWNER = 700;
const JEDA_KOSTA_MENGETIK = 1100;

function IsiPesan({ pesan }: { pesan: PesanChat }) {
  if ("jenis" in pesan && pesan.jenis === "preview") {
    return (
      <div className="w-56">
        <p className="font-semibold">{pesan.judul}</p>
        <dl className="mt-1.5 divide-y divide-black/10 rounded-md border border-black/10 bg-[#f7f5f2] text-xs">
          {pesan.baris.map(([label, nilai]) => (
            <div key={label} className="flex justify-between gap-3 px-2.5 py-1.5">
              <dt className="text-[#667781]">{label}</dt>
              <dd className="font-medium">{nilai}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-1.5 text-xs text-[#54656f]">{pesan.catatan}</p>
      </div>
    );
  }
  if ("jenis" in pesan && pesan.jenis === "invoice") {
    return (
      <>
        {pesan.teks}
        <span className="mt-1.5 flex w-fit items-center gap-1.5 rounded-md bg-[#f0f2f5] px-2 py-1 text-xs font-medium text-[#027eb5]">
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
          "max-w-[85%] rounded-lg px-2.5 py-1.5 text-[0.82rem] leading-snug text-[#111b21] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]",
          dariOwner ? "rounded-tr-none bg-[#d9fdd3]" : "rounded-tl-none bg-white",
        )}
      >
        <span className="sr-only">{dariOwner ? "Owner: " : "Kosta AI: "}</span>
        <IsiPesan pesan={pesan} />
        <span className="mt-0.5 flex items-center justify-end gap-1 text-[0.65rem] text-[#667781]">
          {pesan.waktu}
          {dariOwner && (
            <CheckCheck className="size-3.5 text-[#53bdeb]" aria-label="Sudah dibaca" />
          )}
        </span>
      </div>
    </li>
  );
}

function IndikatorMengetik() {
  return (
    <li className="flex justify-start" aria-label="Kosta AI sedang mengetik">
      <span className="flex gap-1 rounded-lg rounded-tl-none bg-white px-3 py-3 shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]">
        {[0, 150, 300].map((jeda) => (
          <span
            key={jeda}
            className="size-1.5 rounded-full bg-[#8696a0] motion-safe:animate-bounce"
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
    <figure className={cn("mx-auto w-full max-w-sm lg:mr-0", className)}>
      <div className="overflow-hidden rounded-xl border border-black/10 bg-[#efeae2]">
        <div className="flex items-center gap-2.5 border-b border-black/5 bg-[#f0f2f5] px-4 py-2.5 text-[#111b21]">
          <span className="grid size-9 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            K
          </span>
          <div className="leading-tight">
            <p className="text-[0.95rem] font-medium">Kosta AI</p>
            <p className="text-xs text-[#667781]">
              {mengetik ? "mengetik…" : "Asisten Kostera · Kos Melati"}
            </p>
          </div>
        </div>

        <ol
          ref={listRef}
          aria-label="Contoh percakapan dengan Kosta AI"
          className="flex flex-col justify-end gap-2 overflow-hidden px-3 py-4"
          style={tinggiTetap ? { height: tinggiTetap } : undefined}
        >
          <li className="mb-1 self-center rounded-md bg-white px-2.5 py-1 text-[0.68rem] text-[#54656f] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]">
            Hari ini
          </li>
          {CHAT_KOSTA.slice(0, tampil).map((pesan, i) => (
            <Gelembung key={i} pesan={pesan} baru={tinggiTetap !== null} />
          ))}
          {mengetik && <IndikatorMengetik />}
        </ol>

        <div aria-hidden="true" className="flex items-center gap-2 bg-[#f0f2f5] px-3 py-2.5">
          <span className="flex-1 rounded-full bg-white px-3.5 py-2 text-xs text-[#667781]">
            Ketik pesan
          </span>
          <span className="grid size-8 place-items-center rounded-full bg-[#00a884] text-white">
            <SendHorizontal className="size-4" />
          </span>
        </div>
      </div>

      <figcaption className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        Contoh percakapan owner dengan Kosta AI
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
