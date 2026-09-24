import { CheckCheck } from "lucide-react";

import { KartuPreviewAksi } from "@/components/kosta/kartu-preview-aksi";
import { formatJam, formatRupiah } from "@/lib/format";
import type { LampiranKosta, PesanKosta } from "@/lib/types";
import { cn } from "@/lib/utils";

type OnPutuskan = (keputusan: "setuju" | "batal") => void;

function Lampiran({ lampiran, onPutuskan }: { lampiran: LampiranKosta; onPutuskan?: OnPutuskan }) {
  if (lampiran.jenis === "preview_aksi") {
    return <KartuPreviewAksi preview={lampiran} onPutuskan={onPutuskan} />;
  }
  if (lampiran.jenis === "daftar_tagihan") {
    return (
      <figure className="mt-2 overflow-hidden rounded-lg border bg-background/70 text-xs">
        <figcaption className="border-b px-2.5 py-1.5 font-medium">{lampiran.judul}</figcaption>
        <ul className="divide-y">
          {lampiran.baris.map((b) => (
            <li key={b.nomorKamar} className="flex items-start justify-between gap-3 px-2.5 py-1.5">
              <span className="min-w-0">
                <span className="font-medium tabular-nums">{b.nomorKamar}</span> · {b.nama}
                <span className="block text-muted-foreground">{b.keterangan}</span>
              </span>
              <span className="shrink-0 font-medium tabular-nums">{formatRupiah(b.nominal)}</span>
            </li>
          ))}
        </ul>
        <p className="flex justify-between gap-3 border-t bg-muted/60 px-2.5 py-1.5 font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatRupiah(lampiran.total)}</span>
        </p>
      </figure>
    );
  }
  return (
    <figure className="mt-2 overflow-hidden rounded-lg border bg-background/70 text-xs">
      <figcaption className="border-b px-2.5 py-1.5 font-medium">{lampiran.judul}</figcaption>
      <dl className="divide-y">
        {lampiran.baris.map((b) => (
          <div key={b.label} className="flex items-start justify-between gap-3 px-2.5 py-1.5">
            <dt>
              {b.label}
              {b.catatan && <span className="block text-muted-foreground">{b.catatan}</span>}
            </dt>
            <dd className="font-medium tabular-nums">{formatRupiah(b.nominal)}</dd>
          </div>
        ))}
      </dl>
    </figure>
  );
}

/** Bubble satu pesan Kosta/owner; lampiran data ditampilkan dengan format Rupiah. */
export function BubblePesan({
  pesan,
  onPutuskan,
}: {
  pesan: PesanKosta;
  /** Keputusan owner atas preview aksi di pesan ini. */
  onPutuskan?: OnPutuskan;
}) {
  const dariOwner = pesan.dari === "owner";
  return (
    <li className={cn("flex", dariOwner ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-snug whitespace-pre-line shadow-xs sm:max-w-[70%]",
          dariOwner
            ? "rounded-br-sm bg-accent text-accent-foreground"
            : "rounded-bl-sm bg-card text-card-foreground",
          pesan.lampiran && "w-72 max-w-[90%] sm:w-80",
        )}
      >
        <span className="sr-only">{dariOwner ? "Kamu: " : "Kosta: "}</span>
        {pesan.teks}
        {pesan.lampiran && <Lampiran lampiran={pesan.lampiran} onPutuskan={onPutuskan} />}
        <span className="mt-1 flex items-center justify-end gap-1 text-[0.7rem] text-muted-foreground">
          <time dateTime={pesan.waktu}>{formatJam(pesan.waktu)}</time>
          {dariOwner && <CheckCheck className="size-3.5 text-primary" aria-label="Terkirim" />}
        </span>
      </div>
    </li>
  );
}
