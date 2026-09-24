// Ringkasan riwayat percakapan Kosta per hari (WIB) untuk panel riwayat.

import { formatTanggal } from "./format.ts";
import { tanggalWib } from "./waktu.ts";
import type { PesanKosta, PreviewAksi } from "@/lib/types";

export type RingkasanHari = {
  /** YYYY-MM-DD (WIB) */
  tanggal: string;
  jumlahPesan: number;
  /** Pertanyaan pertama owner hari itu. */
  topik: string;
  aksi: Pick<PreviewAksi, "aksi" | "status">[];
};

function kemarin(hariIni: string) {
  const d = new Date(`${hariIni}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** "Hari ini", "Kemarin", atau "20 Sep 2026". */
export function labelHari(tanggal: string, hariIni: string) {
  if (tanggal === hariIni) return "Hari ini";
  if (tanggal === kemarin(hariIni)) return "Kemarin";
  return formatTanggal(tanggal);
}

/** Tanggal WIB sebuah pesan. */
export const tanggalPesan = (pesan: Pick<PesanKosta, "waktu">) => tanggalWib(new Date(pesan.waktu));

/** Riwayat per hari, yang terbaru di atas. */
export function ringkasRiwayat(pesan: PesanKosta[]): RingkasanHari[] {
  const perHari = new Map<string, RingkasanHari>();
  for (const p of pesan) {
    const tanggal = tanggalPesan(p);
    const hari = perHari.get(tanggal) ?? { tanggal, jumlahPesan: 0, topik: "", aksi: [] };
    hari.jumlahPesan += 1;
    if (!hari.topik && p.dari === "owner") hari.topik = p.teks;
    if (p.lampiran?.jenis === "preview_aksi") {
      hari.aksi.push({ aksi: p.lampiran.aksi, status: p.lampiran.status });
    }
    perHari.set(tanggal, hari);
  }
  return [...perHari.values()].sort((a, b) => b.tanggal.localeCompare(a.tanggal));
}
