// Keterangan tampilan invoice yang dipakai beberapa halaman.

import { formatPeriode, formatTanggal, formatTanggalPendek, selisihHari } from "./format.ts";
import type { InvoiceRow } from "@/lib/types";

/** Keterangan waktu: kapan dibayar, atau seberapa dekat/lewat jatuh tempo. */
export function keteranganWaktu(
  inv: Pick<InvoiceRow, "status" | "dibayarPada" | "jatuhTempo">,
  hariIni: string,
) {
  if (inv.status === "lunas" && inv.dibayarPada) {
    return { teks: `Dibayar ${formatTanggalPendek(inv.dibayarPada)}`, telat: false };
  }
  const sisa = selisihHari(hariIni, inv.jatuhTempo);
  if (sisa < 0) return { teks: `Lewat ${-sisa} hari`, telat: true };
  if (sisa === 0) return { teks: "Jatuh tempo hari ini", telat: false };
  return { teks: `${sisa} hari lagi`, telat: false };
}

export type UrutInvoice = "prioritas" | "jatuh_tempo" | "nominal" | "nama" | "kamar";

export const PILIHAN_URUT: { value: UrutInvoice; label: string }[] = [
  { value: "prioritas", label: "Perlu ditindak" },
  { value: "jatuh_tempo", label: "Jatuh tempo terdekat" },
  { value: "nominal", label: "Nominal terbesar" },
  { value: "nama", label: "Nama penghuni A–Z" },
  { value: "kamar", label: "Nomor kamar" },
];

/** Nilai `?urut=` yang tidak dikenal dianggap "prioritas". */
export function parseUrutInvoice(value: string | null | undefined): UrutInvoice {
  return PILIHAN_URUT.some((u) => u.value === value) ? (value as UrutInvoice) : "prioritas";
}

type BarisUrut = Pick<InvoiceRow, "jatuhTempo" | "nominal" | "namaPenghuni" | "nomorKamar">;

const PEMBANDING: Record<Exclude<UrutInvoice, "prioritas">, (a: BarisUrut, b: BarisUrut) => number> = {
  jatuh_tempo: (a, b) => a.jatuhTempo.localeCompare(b.jatuhTempo),
  nominal: (a, b) => b.nominal - a.nominal,
  nama: (a, b) => a.namaPenghuni.localeCompare(b.namaPenghuni, "id"),
  kamar: (a, b) => a.nomorKamar.localeCompare(b.nomorKamar, "id", { numeric: true }),
};

/**
 * Urutkan salinan daftar invoice. "prioritas" mempertahankan urutan dari server
 * (yang perlu ditindak dulu); urutan lain stabil untuk nilai yang sama.
 */
export function urutkanInvoice<T extends BarisUrut>(invoices: T[], urut: UrutInvoice): T[] {
  if (urut === "prioritas") return invoices;
  return [...invoices].sort(PEMBANDING[urut]);
}

/** Peringatan di preview Buat tagihan — tidak memblokir, hanya minta owner memastikan. */
export function peringatanTagihan({
  periode,
  jatuhTempo,
  hariIni,
}: {
  periode: string;
  jatuhTempo: string;
  hariIni: string;
}) {
  const peringatan: string[] = [];
  if (jatuhTempo < hariIni) {
    peringatan.push(
      `Jatuh tempo ${formatTanggal(jatuhTempo)} sudah lewat. Pastikan tanggalnya benar sebelum membuat tagihan.`,
    );
  } else if (!jatuhTempo.startsWith(periode)) {
    peringatan.push(
      `Jatuh tempo ${formatTanggal(jatuhTempo)} berada di luar periode ${formatPeriode(periode)}. Pastikan sudah benar.`,
    );
  }
  return peringatan;
}
