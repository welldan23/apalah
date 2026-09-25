// Format balasan Kosta untuk WhatsApp: lampiran (daftar/rekap/preview) jadi teks biasa berformat WA.
// Di web, lampiran yang sama ditampilkan sebagai kartu.

import { LABEL_AKSI } from "../draft-aksi.ts";
import { formatPeriode, formatRupiah } from "../format.ts";
import type { LampiranKosta } from "@/lib/types";
import { kodeAksi } from "./kode-aksi.ts";
import type { BalasanKosta } from "./tool-baca.ts";

/** Dampak aksi bila disetujui — ditampilkan di preview supaya owner tahu persis apa yang terjadi. */
function dampak(l: Extract<LampiranKosta, { jenis: "preview_aksi" }>) {
  switch (l.aksi) {
    case "reminder":
      return `Dampak: pesan WhatsApp berisi nominal & link invoice dikirim ke ${l.penerima.length} penyewa.`;
    case "tagihan":
      return `Dampak: ${l.penerima.length} tagihan baru dibuat berstatus Menunggu (belum dikirim ke penyewa).`;
    case "pindah_kamar":
      return "Dampak: data penghuni pindah ke kamar tujuan, kamar asal jadi kosong. Tagihan yang sudah terbit tidak berubah.";
    case "keluar_penghuni":
      return "Dampak: penghuni tercatat keluar, kamar jadi kosong, tagihan bulanan berhenti terbit. Tagihan belum lunas tetap tercatat.";
  }
}

function lampiranKeTeks(l: LampiranKosta, namaKos?: string) {
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
  const label = LABEL_AKSI[l.aksi];
  // Konfirmasi wajib menyebut kode aksi, jadi yang disetujui selalu preview ini.
  const kode = l.draftId ? ` ${kodeAksi(l.draftId)}` : "";
  const isi = l.keterangan
    ? [`• ${l.keterangan}`, ...(l.aksi === "keluar_penghuni" && l.total > 0 ? [`${label.labelTotal}: ${formatRupiah(l.total)}`] : [])]
    : [
        ...l.penerima.map((p) => `• ${p.nomorKamar} ${p.nama} — ${formatRupiah(p.nominal)}`),
        `Total ${formatRupiah(l.total)} (${l.penerima.length} penerima)`,
      ];
  return [
    `*Preview ${label.judul} ${formatPeriode(l.periode)}${namaKos ? ` — ${namaKos}` : ""}*`,
    ...isi,
    dampak(l),
    "",
    `Balas *YA${kode}* untuk ${label.kerja}, *BATAL${kode}* untuk membatalkan${l.aksi === "tagihan" ? ', atau koreksi (mis. "kecualikan A05", "B06 jadi 600rb")' : ""}. Berlaku 24 jam.`,
  ].join("\n");
}

/** `namaKos` = kos yang sedang dibahas, disebut di judul preview aksi. */
export function formatWhatsApp({ teks, lampiran }: BalasanKosta, { namaKos }: { namaKos?: string } = {}) {
  return lampiran ? `${teks}\n\n${lampiranKeTeks(lampiran, namaKos)}` : teks;
}

export const TEKS_BANTUAN = [
  "Aku Kosta, asisten kos kamu. Contoh yang bisa kamu tanyakan:",
  "• Berapa tunggakan bulan ini?",
  "• Kamar mana yang masih kosong?",
  "• Rekap pemasukan bulan ini",
  "• Kamar A03 sudah bayar belum?",
  "• Buat tagihan bulan depan",
  "• Siapkan reminder buat yang menunggak / kirim reminder ke A01, A03",
  "• B04 pindah ke B05 / A05 keluar hari ini",
  "Aksi yang mengubah data atau mengirim pesan selalu minta konfirmasimu dulu.",
].join("\n");
