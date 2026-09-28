import { SectionHeading } from "@/components/landing/section-heading";
import { InvoiceStatusBadge } from "@/components/status-badge";
import { formatRupiah } from "@/lib/format";
import { PREVIEW_DASHBOARD } from "@/lib/landing/content";
import { cn } from "@/lib/utils";

/** Cuplikan Dashboard Kos berisi data contoh — tampilan saja, tidak bisa diklik. */
function CuplikanDashboard() {
  const { namaKos, periode, metrik, aksi, jumlahTagihan, statusBayar } = PREVIEW_DASHBOARD;
  return (
    <figure className="min-w-0">
      <div className="overflow-hidden rounded-md border bg-card">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3 sm:px-5">
          <p className="text-lg font-semibold tracking-[-0.01em]">{namaKos}</p>
          <p className="text-sm text-muted-foreground">{periode}</p>
        </div>

        <dl className="grid grid-cols-2 border-b sm:grid-cols-4">
          {metrik.map(({ label, nilai, catatan }, i) => (
            <div
              key={label}
              className={cn(
                "min-w-0 px-4 py-3 sm:px-5",
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

        <ul aria-label="Aksi cepat" className="flex flex-wrap gap-2 border-b px-4 py-3 sm:px-5">
          {aksi.map(({ label }, i) => (
            <li
              key={label}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm font-medium",
                i === 0 ? "border-primary bg-primary text-primary-foreground" : "bg-background",
              )}
            >
              {label}
            </li>
          ))}
        </ul>

        <div className="flex items-baseline justify-between gap-2 px-4 pt-3 pb-1 sm:px-5">
          <p className="text-sm font-semibold">Status bayar</p>
          <p className="text-xs text-muted-foreground">{jumlahTagihan}</p>
        </div>
        <ul className="divide-y">
          {statusBayar.map(({ kamar, nama, nominal, status, keterangan }) => (
            <li key={kamar} className="grid grid-cols-[2.75rem_1fr_auto] items-center gap-2 px-4 py-2.5 sm:px-5">
              <span className="font-mono text-sm font-medium">{kamar}</span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{nama}</p>
                <p className={cn("truncate text-xs text-muted-foreground", status === "jatuh_tempo" && "text-danger")}>
                  {keterangan}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-sm font-semibold">{formatRupiah(nominal)}</span>
                <InvoiceStatusBadge status={status} />
              </div>
            </li>
          ))}
        </ul>
      </div>
      <figcaption className="mt-3 text-xs text-muted-foreground">
        Data contoh {namaKos}, bukan data kos sungguhan.
      </figcaption>
    </figure>
  );
}

export function DashboardPreviewSection() {
  return (
    <section id="preview-dashboard" aria-labelledby="preview-dashboard-judul" className="scroll-mt-20 border-t bg-card">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1fr_1.35fr] lg:gap-16">
        <div>
          <SectionHeading
            id="preview-dashboard-judul"
            judul={PREVIEW_DASHBOARD.judul}
            deskripsi={PREVIEW_DASHBOARD.deskripsi}
          />
          <ul className="mt-8 flex flex-col border-t">
            {PREVIEW_DASHBOARD.sorotan.map((poin) => (
              <li key={poin} className="border-b py-3">
                {poin}
              </li>
            ))}
          </ul>
        </div>
        <CuplikanDashboard />
      </div>
    </section>
  );
}
