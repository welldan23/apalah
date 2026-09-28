// Alur status draft aksi Kosta (tabel action_drafts):
// menunggu_konfirmasi → disetujui → dijalankan, atau menunggu_konfirmasi → dibatalkan.

import type { PreviewAksi, StatusDraftAksi } from "@/lib/types";

export type KeputusanDraft = "setuju" | "batal" | "selesai";

const TRANSISI: Partial<Record<StatusDraftAksi, Partial<Record<KeputusanDraft, StatusDraftAksi>>>> = {
  menunggu_konfirmasi: { setuju: "disetujui", batal: "dibatalkan" },
  disetujui: { selesai: "dijalankan" },
};

/** Status berikutnya, atau null bila keputusan tidak berlaku untuk status saat ini. */
export function statusSetelah(status: StatusDraftAksi, keputusan: KeputusanDraft) {
  return TRANSISI[status]?.[keputusan] ?? null;
}

/** Label jenis aksi Kosta — sama di WhatsApp, kartu preview, dan riwayat. */
export const LABEL_AKSI: Record<
  PreviewAksi["aksi"],
  { judul: string; kerja: string; satuan: string; labelTotal: string }
> = {
  reminder: { judul: "Pengingat", kerja: "kirim", satuan: "penyewa", labelTotal: "Total nominal" },
  tagihan: { judul: "Tagihan", kerja: "buat", satuan: "penyewa", labelTotal: "Total nominal" },
  pindah_kamar: { judul: "Pindah Kamar", kerja: "pindahkan", satuan: "penghuni", labelTotal: "Sewa per bulan" },
  keluar_penghuni: { judul: "Penghuni Keluar", kerja: "catat", satuan: "penghuni", labelTotal: "Tagihan belum lunas" },
};
