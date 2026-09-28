// Cuplikan UI Kostera untuk tahap-tahap alur di landing — data tiruan Kos Melati, dekoratif
// (isinya sudah dijelaskan teks di sebelahnya), tidak bisa diklik.

import { InvoiceStatusBadge } from "@/components/status-badge";
import { formatRupiah } from "@/lib/format";
import { PREVIEW_DASHBOARD } from "@/lib/landing/content";
import type { InvoiceStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function IlustrasiJadwal() {
  const bulan = [
    { label: "Sep", status: "Terbit" },
    { label: "Okt", status: "Terjadwal" },
    { label: "Nov", status: "Terjadwal" },
  ];
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">Terbit otomatis tiap tanggal 1</p>
      <div className="grid grid-cols-3 gap-2">
        {bulan.map(({ label, status }) => (
          <div
            key={label}
            className={cn(
              "rounded-sm border px-2 py-1.5",
              status === "Terbit" ? "border-primary bg-primary text-primary-foreground" : "border-dashed",
            )}
          >
            <p className="text-sm font-semibold">{label}</p>
            <p className={cn("text-xs", status === "Terbit" ? "text-primary-foreground/75" : "text-muted-foreground")}>{status}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function IlustrasiStatus() {
  const baris: [string, string, InvoiceStatus][] = [
    ["B06", "Reza", "lunas"],
    ["C09", "Grace", "perlu_review"],
    ["A05", "Rizky", "jatuh_tempo"],
  ];
  return (
    <ul className="divide-y text-sm">
      {baris.map(([kamar, nama, status]) => (
        <li key={kamar} className="flex items-center gap-2 py-2 first:pt-0 last:pb-0">
          <span className="font-mono text-xs font-medium">{kamar}</span>
          <span className="flex-1 truncate">{nama}</span>
          <InvoiceStatusBadge status={status} />
        </li>
      ))}
    </ul>
  );
}

export function IlustrasiKamar() {
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

/** Dashboard Kos (data contoh) seperti yang dilihat owner — tanpa bingkai browser. */
export function CuplikanDashboard() {
  const { namaKos, periode, metrik, aksi, jumlahTagihan, statusBayar } = PREVIEW_DASHBOARD;
  return (
    <div className="overflow-hidden rounded-md border bg-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3">
        <p className="text-lg font-semibold tracking-[-0.01em]">{namaKos}</p>
        <p className="text-sm text-muted-foreground">{periode}</p>
      </div>
      <dl className="grid grid-cols-2 border-b sm:grid-cols-4">
        {metrik.map(({ label, nilai, catatan }, i) => (
          <div
            key={label}
            className={cn(
              "min-w-0 px-4 py-3",
              i % 2 === 1 && "border-l",
              i >= 2 && "border-t sm:border-t-0",
              i === 2 && "sm:border-l",
            )}
          >
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-2xl font-semibold tracking-[-0.02em]">{nilai}</dd>
            <dd className={cn("text-xs text-muted-foreground", label === "Perlu ditagih" && "text-danger")}>{catatan}</dd>
          </div>
        ))}
      </dl>
      <ul aria-label="Aksi cepat" className="flex flex-wrap gap-2 border-b px-4 py-3">
        {aksi.map(({ label }, i) => (
          <li
            key={label}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm font-medium whitespace-nowrap",
              i === 0 ? "border-primary bg-primary text-primary-foreground" : "bg-background",
            )}
          >
            {label}
          </li>
        ))}
      </ul>
      <div className="flex items-baseline justify-between gap-2 px-4 pt-3 pb-1">
        <p className="text-sm font-semibold">Status bayar</p>
        <p className="text-xs text-muted-foreground">{jumlahTagihan}</p>
      </div>
      <ul className="divide-y">
        {statusBayar.map(({ kamar, nama, nominal, status, keterangan }) => (
          <li key={kamar} className="grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-2 px-4 py-2.5">
            <span className="font-mono text-sm font-medium">{kamar}</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{nama}</p>
              <p className={cn("truncate text-xs text-muted-foreground", status === "jatuh_tempo" && "text-danger")}>{keterangan}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-sm font-semibold">{formatRupiah(nominal)}</span>
              <InvoiceStatusBadge status={status} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
