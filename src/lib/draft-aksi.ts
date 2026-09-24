// Alur status draft aksi Kosta (tabel action_drafts):
// menunggu_konfirmasi → disetujui → dijalankan, atau menunggu_konfirmasi → dibatalkan.

import type { StatusDraftAksi } from "@/lib/types";

export type KeputusanDraft = "setuju" | "batal" | "selesai";

const TRANSISI: Partial<Record<StatusDraftAksi, Partial<Record<KeputusanDraft, StatusDraftAksi>>>> = {
  menunggu_konfirmasi: { setuju: "disetujui", batal: "dibatalkan" },
  disetujui: { selesai: "dijalankan" },
};

/** Status berikutnya, atau null bila keputusan tidak berlaku untuk status saat ini. */
export function statusSetelah(status: StatusDraftAksi, keputusan: KeputusanDraft) {
  return TRANSISI[status]?.[keputusan] ?? null;
}
