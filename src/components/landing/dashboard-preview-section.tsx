import { CircleCheck } from "lucide-react";

import { SectionHeading } from "@/components/landing/section-heading";
import { InvoiceStatusBadge } from "@/components/status-badge";
import { formatRupiah } from "@/lib/format";
import { PREVIEW_DASHBOARD } from "@/lib/landing/content";
import { cn } from "@/lib/utils";

/** Cuplikan Dashboard Kos berisi data contoh — tampilan saja, tidak bisa diklik. */
function BingkaiDashboard() {
  const { alamat, sapaan, namaKos, periode, metrik, aksi, jumlahTagihan, statusBayar } =
    PREVIEW_DASHBOARD;
  return (
    <figure className="min-w-0">
      <div className="overflow-hidden rounded-2xl border bg-background shadow-xs">
        <div aria-hidden="true" className="flex items-center gap-3 border-b bg-muted/60 px-4 py-2.5">
          <span className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <span key={i} className="size-2.5 rounded-full bg-border" />
            ))}
          </span>
          <span className="flex-1 truncate rounded-md bg-background px-3 py-1 text-center text-xs text-muted-foreground">
            {alamat}
          </span>
        </div>

        <div className="flex flex-col gap-4 p-3 sm:p-5">
          <p className="px-1 text-lg font-semibold tracking-tight">{sapaan}</p>

          <div className="relative overflow-hidden rounded-xl bg-primary p-4 text-primary-foreground sm:p-5">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-20 -right-14 size-52 rounded-full border-[24px] border-accent/10"
            />
            <div className="relative flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold tracking-tight">{namaKos}</p>
              <span className="rounded-full bg-accent/15 px-2.5 py-1 text-xs font-medium text-accent">
                {periode}
              </span>
            </div>
            <dl className="relative mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {metrik.map(({ label, nilai, catatan }) => (
                <div key={label} className="min-w-0 border-l border-primary-foreground/15 pl-3">
                  <dt className="text-xs text-primary-foreground/70">{label}</dt>
                  <dd className="mt-0.5 text-xl font-semibold tabular-nums tracking-tight sm:text-2xl">
                    {nilai}
                  </dd>
                  <dd className="text-xs text-accent/90">{catatan}</dd>
                </div>
              ))}
            </dl>
          </div>

          <ul aria-label="Aksi cepat" className="grid grid-cols-3 gap-2">
            {aksi.map(({ label, icon: Icon }, i) => (
              <li
                key={label}
                className={cn(
                  "flex flex-col items-center justify-center gap-1.5 rounded-lg border px-2 py-3 text-center text-xs font-medium sm:flex-row sm:py-2 sm:text-sm",
                  i === 0 ? "border-transparent bg-primary text-primary-foreground" : "bg-background",
                )}
              >
                <Icon className="size-5 shrink-0 sm:size-4" aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>

          <div className="rounded-xl border bg-card">
            <div className="flex items-baseline justify-between gap-2 border-b px-3 py-3 sm:px-4">
              <p className="text-sm font-semibold">Status bayar</p>
              <p className="text-xs text-muted-foreground">{jumlahTagihan}</p>
            </div>
            <ul className="divide-y">
              {statusBayar.map(({ kamar, nama, nominal, status, keterangan }) => (
                <li key={kamar} className="flex items-center gap-2.5 px-3 py-2.5 sm:gap-3 sm:px-4">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-xs font-semibold tabular-nums sm:size-9">
                    {kamar}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{nama}</p>
                    <p
                      className={cn(
                        "truncate text-xs text-muted-foreground",
                        status === "jatuh_tempo" && "text-danger",
                      )}
                    >
                      {keterangan}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-sm font-semibold tabular-nums">{formatRupiah(nominal)}</span>
                    <InvoiceStatusBadge status={status} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-xs text-muted-foreground">
        Data contoh {namaKos}, bukan data kos sungguhan.
      </figcaption>
    </figure>
  );
}

export function DashboardPreviewSection() {
  return (
    <section
      id="preview-dashboard"
      aria-labelledby="preview-dashboard-judul"
      className="scroll-mt-20 border-t bg-card/60"
    >
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1fr_1.35fr] lg:items-center lg:gap-12">
        <div>
          <SectionHeading
            id="preview-dashboard-judul"
            eyebrow="Dashboard Kos"
            judul={PREVIEW_DASHBOARD.judul}
            deskripsi={PREVIEW_DASHBOARD.deskripsi}
          />
          <ul className="mt-6 flex flex-col gap-2.5 text-sm">
            {PREVIEW_DASHBOARD.sorotan.map((poin) => (
              <li key={poin} className="flex gap-2">
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                {poin}
              </li>
            ))}
          </ul>
        </div>
        <BingkaiDashboard />
      </div>
    </section>
  );
}
