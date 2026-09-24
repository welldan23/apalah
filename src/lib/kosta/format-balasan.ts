// Format balasan Kosta untuk WhatsApp: lampiran (daftar/rekap/preview) jadi teks biasa berformat WA.
// Di web, lampiran yang sama ditampilkan sebagai kartu.

import { formatPeriode, formatRupiah } from "../format.ts";
import type { LampiranKosta } from "@/lib/types";
import type { BalasanKosta } from "./tool-baca.ts";

function lampiranKeTeks(l: LampiranKosta) {
  if (l.jenis === "daftar_tagihan") {
    return [
      `*${l.judul}*`,
      ...l.baris.map((b) => `• ${b.nomorKamar} ${b.nama} — ${formatRupiah(b.nominal)} (${b.keterangan})`),
      `Total ${formatRupiah(l.total)}`,
    ].join("\n");
  }
  if (l.jenis === "rekap") {
    return [
      `*${l.judul}*`,
      ...l.baris.map((b) => `• ${b.label}: ${formatRupiah(b.nominal)}${b.catatan ? ` (${b.catatan})` : ""}`),
    ].join("\n");
  }
  const kata = l.aksi === "reminder" ? { judul: "Pengingat", aksi: "kirim" } : { judul: "Tagihan", aksi: "buat" };
  return [
    `*Preview ${kata.judul} ${formatPeriode(l.periode)}*`,
    ...l.penerima.map((p) => `• ${p.nomorKamar} ${p.nama} — ${formatRupiah(p.nominal)}`),
    `Total ${formatRupiah(l.total)} (${l.penerima.length} penerima)`,
    "",
    `Balas *YA* untuk ${kata.aksi}, *BATAL* untuk membatalkan${l.aksi === "tagihan" ? ', atau koreksi (mis. "kecualikan A05", "B06 jadi 600rb")' : ""}.`,
  ].join("\n");
}

export function formatWhatsApp({ teks, lampiran }: BalasanKosta) {
  return lampiran ? `${teks}\n\n${lampiranKeTeks(lampiran)}` : teks;
}

export const TEKS_BANTUAN = [
  "Aku Kosta, asisten kos kamu. Contoh yang bisa kamu tanyakan:",
  "• Berapa tunggakan bulan ini?",
  "• Kamar mana yang masih kosong?",
  "• Rekap pemasukan bulan ini",
  "• Kamar A03 sudah bayar belum?",
  "• Buat tagihan bulan depan",
  "• Siapkan reminder buat yang menunggak",
  "Aksi yang mengubah data atau mengirim pesan selalu minta konfirmasimu dulu.",
].join("\n");
