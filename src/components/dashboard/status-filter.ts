import { labelStatusInvoice } from "@/components/status-badge";
import type { InvoiceStatus } from "@/lib/types";

// Filter status tabel invoice di Dashboard Kos, disimpan di URL (?status=…)
// supaya bisa dibuka langsung dari kartu lain, di-reload, atau dibagikan.

export type StatusFilter = "semua" | InvoiceStatus;

const URUTAN_FILTER: InvoiceStatus[] = ["jatuh_tempo", "perlu_review", "menunggu", "lunas"];

export const STATUS_FILTER: { value: StatusFilter; label: string }[] = [
  { value: "semua", label: "Semua" },
  ...URUTAN_FILTER.map((status) => ({ value: status, label: labelStatusInvoice(status) })),
];

/** Nilai `?status=` yang tidak dikenal dianggap "semua". */
export function parseStatusFilter(value: string | null | undefined): StatusFilter {
  return STATUS_FILTER.some((f) => f.value === value) ? (value as StatusFilter) : "semua";
}

/** Link ke tabel status bayar yang sudah tersaring. */
export function hrefStatusFilter(filter: StatusFilter) {
  const query = filter === "semua" ? "" : `?status=${filter}`;
  return `/dashboard${query}#status-bayar`;
}
