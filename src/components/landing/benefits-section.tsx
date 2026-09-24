import { CalendarClock } from "lucide-react";

import { SectionHeading } from "@/components/landing/section-heading";
import { InvoiceStatusBadge } from "@/components/status-badge";
import { BENEFIT, type Benefit } from "@/lib/landing/content";
import type { InvoiceStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

// Cuplikan UI Kostera (data tiruan) — dekoratif; isi kartu sudah dijelaskan teksnya.

function IlustrasiJadwal() {
  const bulan = [
    { label: "Sep", status: "Terbit" },
    { label: "Okt", status: "Terjadwal" },
    { label: "Nov", status: "Terjadwal" },
  ];
  return (
    <div className="flex flex-col gap-2.5">
      <p className="flex items-center gap-1.5 text-xs font-medium">
        <CalendarClock className="size-3.5 text-primary" />
        Terbit otomatis tiap tanggal 1
      </p>
      <div className="grid grid-cols-3 gap-1.5">
        {bulan.map(({ label, status }) => (
          <div
            key={label}
            className={cn(
              "rounded-lg border px-2 py-1.5 text-center",
              status === "Terbit" ? "border-primary/30 bg-accent" : "border-dashed bg-card",
            )}
          >
            <p className="text-xs font-semibold">{label}</p>
            <p className="text-[0.65rem] text-muted-foreground">{status}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function IlustrasiStatus() {
  const baris: [string, InvoiceStatus][] = [
    ["B06 · Reza", "lunas"],
    ["C09 · Grace", "menunggu"],
    ["A05 · Rizky", "jatuh_tempo"],
    ["B11 · Rina", "perlu_review"],
  ];
  return (
    <ul className="flex flex-col gap-1.5">
      {baris.map(([nama, status]) => (
        <li key={nama} className="flex items-center justify-between gap-2 rounded-lg bg-card px-2.5 py-1.5">
          <span className="truncate text-xs font-medium">{nama}</span>
          <InvoiceStatusBadge status={status} />
        </li>
      ))}
    </ul>
  );
}

function IlustrasiKamar() {
  const kosong = new Set([3, 9]);
  return (
    <div className="flex flex-col gap-2.5">
      <p className="flex items-center justify-between text-xs">
        <span className="font-medium">Lantai 1</span>
        <span className="text-muted-foreground">10/12 terisi</span>
      </p>
      <ul className="grid grid-cols-6 gap-1">
        {Array.from({ length: 12 }, (_, i) => (
          <li
            key={i}
            className={cn(
              "grid h-7 place-items-center rounded-md text-[0.6rem] font-semibold",
              kosong.has(i)
                ? "border border-dashed border-warning/60 bg-warning-soft text-warning"
                : "bg-accent text-accent-foreground",
            )}
          >
            A{String(i + 1).padStart(2, "0")}
          </li>
        ))}
      </ul>
    </div>
  );
}

const ILUSTRASI: Record<Benefit["ilustrasi"], () => React.ReactNode> = {
  jadwal: IlustrasiJadwal,
  status: IlustrasiStatus,
  kamar: IlustrasiKamar,
};

export function BenefitsSection() {
  return (
    <section id="fitur" aria-labelledby="fitur-judul" className="scroll-mt-20 border-y bg-card/60">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <SectionHeading
          id="fitur-judul"
          eyebrow="Fitur"
          judul="Semua urusan tagihan kos dalam satu tempat"
          deskripsi="Dashboard untuk melihat kondisi kos sekilas, ditambah Kosta di WhatsApp untuk urusan harian."
        />
        <ul className="mt-8 grid gap-4 md:grid-cols-3">
          {BENEFIT.map(({ icon: Icon, judul, deskripsi, ilustrasi }) => {
            const Ilustrasi = ILUSTRASI[ilustrasi];
            return (
              // Subgrid di layar lebar: tinggi ilustrasi disamakan antar kartu supaya judulnya sejajar.
              <li
                key={judul}
                className="flex flex-col rounded-2xl border bg-background p-2 md:row-span-2 md:grid md:grid-rows-subgrid md:gap-0"
              >
                <div aria-hidden="true" className="rounded-xl bg-muted p-3.5 md:min-h-40">
                  <Ilustrasi />
                </div>
                <div className="px-3.5 pt-4 pb-3.5">
                  <h3 className="flex items-center gap-2 font-semibold">
                    <Icon className="size-4.5 text-primary" aria-hidden="true" />
                    {judul}
                  </h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{deskripsi}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
