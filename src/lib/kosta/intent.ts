// Intent pesan owner ke Kosta + daftar tool terbatas yang boleh dipilih parser (LLM atau aturan).
// Parser hanya menghasilkan intent & parameter; angka dan status selalu diambil tool dari database.

import { periodeBerikutnya, periodeSebelumnya } from "../format.ts";
import { periodeValid } from "../waktu.ts";

export type Intent =
  | { intent: "lihat_tunggakan"; periode?: string }
  | { intent: "kamar_kosong" }
  | { intent: "rekap_pemasukan"; periode?: string }
  | { intent: "cek_kamar"; nomorKamar: string; periode?: string }
  | { intent: "draft_tagihan"; periode?: string }
  | { intent: "siapkan_reminder" }
  | { intent: "pindah_penghuni"; dariKamar: string; keKamar: string }
  | { intent: "konfirmasi"; setuju: boolean }
  | { intent: "ganti_kos" }
  /** Tidak dikenali / di luar kemampuan Kosta. */
  | { intent: "bantuan" };

export type NamaIntent = Intent["intent"];

type Properti = Record<string, { type: string; description: string }>;
const periode = { type: "string", description: "Periode tagihan YYYY-MM. Kosongkan untuk bulan berjalan." };
const kamar = (description: string) => ({ type: "string", description });

/** Tool yang boleh dipilih LLM (format JSON Schema function calling). */
export const ALAT: { name: Exclude<NamaIntent, "bantuan">; description: string; properties: Properti; required?: string[] }[] = [
  { name: "lihat_tunggakan", description: "Tagihan yang belum dibayar / menunggak / jatuh tempo.", properties: { periode } },
  { name: "kamar_kosong", description: "Kamar yang masih kosong / belum terisi.", properties: {} },
  { name: "rekap_pemasukan", description: "Rekap uang masuk / pemasukan / pendapatan.", properties: { periode } },
  {
    name: "cek_kamar",
    description: "Status tagihan & pembayaran satu kamar tertentu (mis. 'A03 sudah bayar?').",
    properties: { nomorKamar: kamar("Nomor kamar, mis. A03."), periode },
    required: ["nomorKamar"],
  },
  { name: "draft_tagihan", description: "Siapkan draft tagihan sewa untuk penghuni.", properties: { periode } },
  { name: "siapkan_reminder", description: "Siapkan pesan pengingat untuk penyewa yang menunggak.", properties: {} },
  {
    name: "pindah_penghuni",
    description: "Pindahkan penghuni dari satu kamar ke kamar lain.",
    properties: { dariKamar: kamar("Kamar asal, mis. A03."), keKamar: kamar("Kamar tujuan, mis. B05.") },
    required: ["dariKamar", "keKamar"],
  },
  {
    name: "konfirmasi",
    description: "Jawaban owner atas preview aksi: setuju (ya/kirim) atau batal.",
    properties: { setuju: { type: "boolean", description: "true bila setuju, false bila batal." } },
    required: ["setuju"],
  },
  { name: "ganti_kos", description: "Ganti kos / workspace yang sedang dibahas.", properties: {} },
];

/** "a 3" / "A-03" → "A03"; null bila bukan nomor kamar. */
export function normalisasiKamar(nilai: unknown) {
  if (typeof nilai !== "string") return null;
  const m = /^([a-z]{0,2})\s*-?\s*(\d{1,3})$/i.exec(nilai.trim());
  if (!m) return null;
  return `${m[1].toUpperCase()}${m[1] ? m[2].padStart(2, "0") : m[2]}`;
}

const periodeAtauKosong = (nilai: unknown) =>
  typeof nilai === "string" && periodeValid(nilai) ? { periode: nilai } : {};

/** Validasi hasil parser (terutama LLM) secara deterministik; yang tidak sah → bantuan. */
export function validasiIntent(mentah: unknown): Intent {
  const x = (mentah && typeof mentah === "object" ? mentah : {}) as Record<string, unknown>;
  switch (x.intent) {
    case "lihat_tunggakan":
    case "rekap_pemasukan":
    case "draft_tagihan":
      return { intent: x.intent, ...periodeAtauKosong(x.periode) };
    case "kamar_kosong":
    case "siapkan_reminder":
    case "ganti_kos":
      return { intent: x.intent };
    case "cek_kamar": {
      const nomorKamar = normalisasiKamar(x.nomorKamar);
      return nomorKamar ? { intent: "cek_kamar", nomorKamar, ...periodeAtauKosong(x.periode) } : { intent: "bantuan" };
    }
    case "pindah_penghuni": {
      const dariKamar = normalisasiKamar(x.dariKamar);
      const keKamar = normalisasiKamar(x.keKamar);
      return dariKamar && keKamar && dariKamar !== keKamar
        ? { intent: "pindah_penghuni", dariKamar, keKamar }
        : { intent: "bantuan" };
    }
    case "konfirmasi":
      return typeof x.setuju === "boolean" ? { intent: "konfirmasi", setuju: x.setuju } : { intent: "bantuan" };
    default:
      return { intent: "bantuan" };
  }
}

const bersih = (teks: string) => teks.trim().toLowerCase().replace(/[.!?,]+$/g, "").replace(/\s+/g, " ");

/** Perintah pendek yang pasti maknanya — tidak perlu LLM. */
export function parseCepat(teks: string): Intent | null {
  const t = bersih(teks);
  if (/^(ya|iya|y|ok|oke|setuju|lanjut|kirim|gas|yes)( (kirim|dong|aja|saja))?$/.test(t)) return { intent: "konfirmasi", setuju: true };
  if (/^(batal|batalkan|tidak|nggak|gak|ga|jangan|no|cancel)( (dulu|aja|saja|kirim))?$/.test(t)) return { intent: "konfirmasi", setuju: false };
  if (/^(ganti|pilih|pindah) (kos|workspace)$/.test(t)) return { intent: "ganti_kos" };
  return null;
}

const NAMA_BULAN = ["jan", "feb", "mar", "apr", "mei", "jun", "jul", "agu", "sep", "okt", "nov", "des"];

/** "bulan lalu", "september", "okt 2026" → YYYY-MM (relatif ke hariIni); undefined = bulan berjalan. */
export function periodeDariTeks(teks: string, hariIni: string): string | undefined {
  const t = bersih(teks);
  const sekarang = hariIni.slice(0, 7);
  if (/bulan (lalu|kemarin|sebelumnya)/.test(t)) return periodeSebelumnya(sekarang);
  if (/bulan depan/.test(t)) return periodeBerikutnya(sekarang);
  const m = /\b(jan|feb|mar|apr|mei|jun|jul|agu|agt|ags|sep|okt|nov|des)[a-z]*\b(?:\s+(\d{4}))?/.exec(t);
  if (!m) return undefined;
  const indeks = m[1].startsWith("ag") ? 7 : NAMA_BULAN.indexOf(m[1]);
  return `${m[2] ?? sekarang.slice(0, 4)}-${String(indeks + 1).padStart(2, "0")}`;
}

/** Cadangan tanpa LLM: kata kunci sederhana. */
export function parseKataKunci(teks: string, hariIni: string): Intent {
  const t = bersih(teks);
  const periode = periodeDariTeks(t, hariIni);
  const p = periode ? { periode } : {};
  const kamarDisebut = [...t.matchAll(/\b([a-z]{1,2}\s?-?\d{1,3})\b/g)].map((m) => normalisasiKamar(m[1])).filter((k): k is string => !!k);

  if (/\bpindah(kan)?\b/.test(t) && kamarDisebut.length >= 2) {
    return validasiIntent({ intent: "pindah_penghuni", dariKamar: kamarDisebut[0], keKamar: kamarDisebut[1] });
  }
  if (/remind|ingatkan|pengingat|tagih yang/.test(t)) return { intent: "siapkan_reminder" };
  if (/(buat|bikin|siapkan|terbitkan).*tagihan|draft tagihan/.test(t)) return { intent: "draft_tagihan", ...p };
  if (kamarDisebut.length === 1 && /bayar|lunas|tagihan|status/.test(t)) {
    return { intent: "cek_kamar", nomorKamar: kamarDisebut[0], ...p };
  }
  if (/tunggak|nunggak|belum bayar|belum lunas|jatuh tempo|telat/.test(t)) return { intent: "lihat_tunggakan", ...p };
  if (/kosong|belum terisi|kamar (yang )?(masih )?tersedia/.test(t)) return { intent: "kamar_kosong" };
  if (/rekap|pemasukan|pendapatan|uang masuk|omzet/.test(t)) return { intent: "rekap_pemasukan", ...p };
  return { intent: "bantuan" };
}
