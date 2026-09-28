import { SectionHeading } from "@/components/landing/section-heading";
import { InvoiceStatusBadge } from "@/components/status-badge";
import { BENEFIT, type Benefit } from "@/lib/landing/content";
import type { InvoiceStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

// Cuplikan UI Kostera (data tiruan) — dekoratif; isinya sudah dijelaskan teks di sebelahnya.

function IlustrasiJadwal() {
  const bulan = [
    { label: "Sep", status: "Terbit" },
    { label: "Okt", status: "Terjadwal" },
    { label: "Nov", status: "Terjadwal" },
  ];
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">Terbit otomatis tiap tanggal 1</p>
      <div className="grid grid-cols-3 gap-1.5">
        {bulan.map(({ label, status }) => (
          <div
            key={label}
            className={cn(
              "rounded-sm border px-2 py-1.5",
              status === "Terbit" ? "border-primary bg-primary text-primary-foreground" : "border-dashed",
            )}
          >
            <p className="text-sm font-semibold">{label}</p>
            <p className={cn("text-[0.7rem]", status === "Terbit" ? "text-primary-foreground/75" : "text-muted-foreground")}>
              {status}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function IlustrasiStatus() {
  const baris: [string, string, InvoiceStatus][] = [
    ["B06", "Reza", "lunas"],
    ["C09", "Grace", "perlu_review"],
    ["A05", "Rizky", "jatuh_tempo"],
  ];
  return (
    <ul className="divide-y text-sm">
      {baris.map(([kamar, nama, status]) => (
        <li key={kamar} className="flex items-center gap-2 py-1.5 first:pt-0 last:pb-0">
          <span className="font-mono text-xs font-medium">{kamar}</span>
          <span className="flex-1 truncate">{nama}</span>
          <InvoiceStatusBadge status={status} />
        </li>
      ))}
    </ul>
  );
}

function IlustrasiKamar() {
  const kosong = new Set([3, 9]);
  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Lantai 1</span>
        <span>10/12 terisi</span>
      </p>
      <ul className="grid grid-cols-6 gap-1">
        {Array.from({ length: 12 }, (_, i) => (
          <li
            key={i}
            className={cn(
              "grid h-7 place-items-center rounded-sm font-mono text-[0.62rem] font-medium",
              kosong.has(i) ? "border border-dashed border-warning text-warning" : "bg-secondary text-secondary-foreground",
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

/** Perintah chat pertama di deskripsi (teks di dalam “…”), ditampilkan sebagai pesan WhatsApp. */
const perintahChat = (deskripsi: string) => /“([^”]+)”/.exec(deskripsi)?.[1];

export function BenefitsSection() {
  return (
    <section id="fitur" aria-labelledby="fitur-judul" className="scroll-mt-20 border-y bg-card">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <SectionHeading
          id="fitur-judul"
          judul="Urusan kos cukup lewat chat WhatsApp"
          deskripsi="Kosta AI di WhatsApp untuk urusan harian, dashboard untuk melihat semuanya sekaligus."
        />
        <ul className="mt-12 border-t-2 border-foreground">
          {BENEFIT.map(({ judul, deskripsi, ilustrasi }) => {
            const Ilustrasi = ILUSTRASI[ilustrasi];
            const perintah = perintahChat(deskripsi);
            return (
              <li
                key={judul}
                className="grid gap-5 border-b py-8 md:grid-cols-[1fr_1.2fr] md:gap-10 lg:grid-cols-[13rem_1fr_17rem]"
              >
                <div>
                  <h3 className="text-xl font-semibold tracking-[-0.01em]">{judul}</h3>
                  {perintah && (
                    <p className="mt-3 w-fit max-w-full rounded-lg rounded-tr-none bg-[#d9fdd3] px-2.5 py-1.5 text-sm text-[#111b21] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]">
                      <span className="sr-only">Contoh chat: </span>
                      {perintah}
                    </p>
                  )}
                </div>
                <p className="max-w-prose text-pretty text-muted-foreground">{deskripsi}</p>
                <div aria-hidden="true" className="rounded-md border bg-background p-3 md:col-span-2 lg:col-span-1">
                  <Ilustrasi />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
