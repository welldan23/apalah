// Aturan tagihan terjadwal bulanan — fungsi murni, dipakai halaman pengaturan dan penjadwal.
// Semua tanggal adalah tanggal kalender WIB "YYYY-MM-DD"; periode "YYYY-MM".

import { periodeBerikutnya } from "./format.ts";

export type AturanJatuhTempo =
  /** Jatuh tempo mengikuti tanggal masuk penghuni (mis. masuk tgl 15 → jatuh tempo tgl 15). */
  | { aturan: "tanggal_masuk" }
  /** Jatuh tempo di tanggal yang sama untuk semua penghuni. */
  | { aturan: "tanggal_tetap"; tanggal: number };

export type PengaturanTagihanTerjadwal = {
  aktif: boolean;
  /** Tanggal terbit tagihan tiap bulan, 1–28. */
  tanggalTerbit: number;
  jatuhTempo: AturanJatuhTempo;
};

export const PENGATURAN_BAWAAN: PengaturanTagihanTerjadwal = {
  aktif: false,
  tanggalTerbit: 1,
  jatuhTempo: { aturan: "tanggal_masuk" },
};

const dua = (n: number) => String(n).padStart(2, "0");

function jumlahHari(periode: string) {
  const [tahun, bulan] = periode.split("-").map(Number);
  return new Date(Date.UTC(tahun, bulan, 0)).getUTCDate();
}

/** Penerbitan berikutnya: bulan ini bila tanggal terbitnya belum lewat, selain itu bulan depan. */
export function terbitBerikutnya(tanggalTerbit: number, hariIni: string) {
  const periodeIni = hariIni.slice(0, 7);
  const hari = Number(hariIni.slice(8, 10));
  const periode = hari <= tanggalTerbit ? periodeIni : periodeBerikutnya(periodeIni);
  return { periode, tanggal: `${periode}-${dua(tanggalTerbit)}` };
}

/** Jatuh tempo tagihan satu penghuni di suatu periode; tanggal di luar panjang bulan dipotong ke akhir bulan. */
export function jatuhTempoUntuk(
  aturan: AturanJatuhTempo,
  periode: string,
  tanggalMasuk: string,
) {
  const hari = aturan.aturan === "tanggal_tetap" ? aturan.tanggal : Number(tanggalMasuk.slice(8, 10));
  return `${periode}-${dua(Math.min(hari, jumlahHari(periode)))}`;
}

/** Peringatan pengaturan yang berisiko — tidak memblokir penyimpanan. */
export function peringatanJadwal(p: PengaturanTagihanTerjadwal) {
  const peringatan: string[] = [];
  if (p.jatuhTempo.aturan === "tanggal_tetap" && p.jatuhTempo.tanggal < p.tanggalTerbit) {
    peringatan.push(
      `Jatuh tempo (tanggal ${p.jatuhTempo.tanggal}) lebih awal dari tanggal terbit (tanggal ${p.tanggalTerbit}), jadi tagihan langsung terlambat begitu terbit.`,
    );
  }
  if (p.jatuhTempo.aturan === "tanggal_masuk" && p.tanggalTerbit > 1) {
    peringatan.push(
      `Penghuni yang masuk sebelum tanggal ${p.tanggalTerbit} akan menerima tagihan setelah jatuh temponya lewat. Pilih tanggal terbit 1 agar aman.`,
    );
  }
  return peringatan;
}

/** "Terbit tiap tanggal 1, jatuh tempo mengikuti tanggal masuk penghuni." */
export function ringkasJadwal(p: PengaturanTagihanTerjadwal) {
  const jatuhTempo =
    p.jatuhTempo.aturan === "tanggal_masuk"
      ? "jatuh tempo mengikuti tanggal masuk penghuni"
      : `jatuh tempo tiap tanggal ${p.jatuhTempo.tanggal}`;
  return `Terbit tiap tanggal ${p.tanggalTerbit}, ${jatuhTempo}.`;
}
