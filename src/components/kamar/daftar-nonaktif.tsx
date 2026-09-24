import { ChevronDown } from "lucide-react";

import type { PenghuniNonaktif } from "@/lib/data/kamar";
import { formatTanggal } from "@/lib/format";
import { lamaTinggal } from "@/lib/penghuni";

/** Daftar penghuni nonaktif (sudah keluar), bisa dibuka-tutup. */
export function DaftarNonaktif({ penghuni }: { penghuni: PenghuniNonaktif[] }) {
  return (
    <details className="group rounded-2xl border bg-card">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 font-semibold [&::-webkit-details-marker]:hidden">
        <span>
          Penghuni nonaktif
          <span className="ml-1.5 text-sm font-normal text-muted-foreground">· {penghuni.length}</span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className="size-4 text-muted-foreground transition-transform group-open:rotate-180"
        />
      </summary>
      {penghuni.length === 0 ? (
        <p className="border-t px-4 py-6 text-center text-sm text-muted-foreground">
          Belum ada penghuni yang keluar.
        </p>
      ) : (
        <ul className="divide-y border-t">
          {penghuni.map((p) => (
            <li key={p.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{p.nama}</p>
                <p className="text-xs text-muted-foreground">
                  Kamar {p.nomorKamar} · {formatTanggal(p.tanggalMasuk)} –{" "}
                  {p.tanggalKeluar ? formatTanggal(p.tanggalKeluar) : "?"}
                </p>
              </div>
              {p.tanggalKeluar && (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {lamaTinggal(p.tanggalMasuk, p.tanggalKeluar)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
