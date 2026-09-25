// Intent pesan owner ke Kosta + daftar tool terbatas yang boleh dipilih parser (LLM atau aturan).
// Parser hanya menghasilkan intent & parameter; angka dan status selalu diambil tool dari database.

import { periodeBerikutnya, periodeSebelumnya } from "../format.ts";
import { periodeValid } from "../waktu.ts";

export type Intent =
  | { intent: "lihat_tunggakan"; periode?: string }
  | { intent: "kamar_kosong" }
  /** `rentang` "minggu_ini" = uang masuk sejak Senin minggu berjalan; kosong = per bulan (periode). */
  | { intent: "rekap_pemasukan"; periode?: string; rentang?: "minggu_ini" }
  | { intent: "cek_kamar"; nomorKamar: string; periode?: string }
  | { intent: "draft_tagihan"; periode?: string }
  /** `kamar` kosong = semua yang menunggak; berisi = hanya tagihan belum dibayar kamar-kamar itu. */
  | { intent: "siapkan_reminder"; kamar?: string[] }
  | { intent: "pindah_penghuni"; dariKamar: string; keKamar: string }
  /** `kode` = kode aksi 6 digit dari preview; wajib untuk menyetujui. */
  | { intent: "konfirmasi"; setuju: boolean; kode?: string }
  | {
      intent: "koreksi_draft";
      kecualikan?: string[];
      nominal?: { nomorKamar: string; nominal: number }[];
      tanggalJatuhTempo?: number;
    }
  | { intent: "ganti_kos" }
  /** Tidak dikenali / di luar kemampuan Kosta. */
  | { intent: "bantuan" };

export type NamaIntent = Intent["intent"];

type Properti = Record<string, { type: string; description: string; items?: Record<string, unknown> }>;
const periode = { type: "string", description: "Periode tagihan YYYY-MM. Kosongkan untuk bulan berjalan." };
const kamar = (description: string) => ({ type: "string", description });

/** Tool yang boleh dipilih LLM (format JSON Schema function calling). */
export const ALAT: { name: Exclude<NamaIntent, "bantuan">; description: string; properties: Properti; required?: string[] }[] = [
  { name: "lihat_tunggakan", description: "Tagihan yang belum dibayar / menunggak / jatuh tempo.", properties: { periode } },
  { name: "kamar_kosong", description: "Kamar yang masih kosong / belum terisi.", properties: {} },
  {
    name: "rekap_pemasukan",
    description: "Rekap uang masuk / pemasukan / pendapatan.",
    properties: {
      periode,
      rentang: { type: "string", description: 'Isi "minggu_ini" bila owner minta rekap minggu ini; kosongkan untuk rekap per bulan.' },
    },
  },
  {
    name: "cek_kamar",
    description: "Status tagihan & pembayaran satu kamar tertentu (mis. 'A03 sudah bayar?').",
    properties: { nomorKamar: kamar("Nomor kamar, mis. A03."), periode },
    required: ["nomorKamar"],
  },
  { name: "draft_tagihan", description: "Siapkan draft tagihan sewa untuk penghuni.", properties: { periode } },
  {
    name: "siapkan_reminder",
    description: "Siapkan pesan pengingat bayar untuk penyewa yang menunggak, atau untuk kamar tertentu yang disebut.",
    properties: {
      kamar: {
        type: "array",
        description: "Nomor kamar yang mau diingatkan, mis. A01. Kosongkan untuk semua yang menunggak.",
        items: { type: "string" },
      },
    },
  },
  {
    name: "pindah_penghuni",
    description: "Pindahkan penghuni dari satu kamar ke kamar lain.",
    properties: { dariKamar: kamar("Kamar asal, mis. A03."), keKamar: kamar("Kamar tujuan, mis. B05.") },
    required: ["dariKamar", "keKamar"],
  },
  {
    name: "konfirmasi",
    description: "Jawaban owner atas preview aksi: setuju (ya/kirim) atau batal, biasanya dengan kode aksi 6 digit.",
    properties: {
      setuju: { type: "boolean", description: "true bila setuju, false bila batal." },
      kode: { type: "string", description: "Kode aksi 6 digit yang ditulis owner, mis. 482913. Kosongkan bila tidak disebut." },
    },
    required: ["setuju"],
  },
  {
    name: "koreksi_draft",
    description:
      "Ubah draft tagihan yang sedang menunggu konfirmasi: kecualikan kamar, ubah nominal kamar, atau ubah tanggal jatuh tempo.",
    properties: {
      kecualikan: { type: "array", description: "Nomor kamar yang tidak jadi ditagih.", items: { type: "string" } },
      nominal: {
        type: "array",
        description: "Nominal sewa baru per kamar (rupiah, angka bulat).",
        items: {
          type: "object",
          properties: { nomorKamar: { type: "string" }, nominal: { type: "integer" } },
          required: ["nomorKamar", "nominal"],
        },
      },
      tanggalJatuhTempo: { type: "integer", description: "Tanggal jatuh tempo baru (1–31)." },
    },
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
      return { intent: x.intent, ...periodeAtauKosong(x.periode), ...(x.rentang === "minggu_ini" ? { rentang: "minggu_ini" as const } : {}) };
    case "draft_tagihan":
      return { intent: x.intent, ...periodeAtauKosong(x.periode) };
    case "siapkan_reminder": {
      const kamar = [...new Set((Array.isArray(x.kamar) ? x.kamar : []).map(normalisasiKamar).filter((k): k is string => !!k))].slice(0, 50);
      return kamar.length ? { intent: "siapkan_reminder", kamar } : { intent: "siapkan_reminder" };
    }
    case "kamar_kosong":
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
      if (typeof x.setuju !== "boolean") return { intent: "bantuan" };
      return typeof x.kode === "string" && /^\d{6}$/.test(x.kode)
        ? { intent: "konfirmasi", setuju: x.setuju, kode: x.kode }
        : { intent: "konfirmasi", setuju: x.setuju };
    case "koreksi_draft": {
      const kecualikan = (Array.isArray(x.kecualikan) ? x.kecualikan : [])
        .map(normalisasiKamar)
        .filter((k): k is string => !!k);
      const nominal = (Array.isArray(x.nominal) ? x.nominal : []).flatMap((n: { nomorKamar?: unknown; nominal?: unknown }) => {
        const nomorKamar = normalisasiKamar(n?.nomorKamar);
        const nilai = n?.nominal;
        return nomorKamar && Number.isInteger(nilai) && (nilai as number) > 0 && (nilai as number) <= 1_000_000_000
          ? [{ nomorKamar, nominal: nilai as number }]
          : [];
      });
      const tanggal = x.tanggalJatuhTempo;
      const tanggalJatuhTempo = Number.isInteger(tanggal) && (tanggal as number) >= 1 && (tanggal as number) <= 31 ? (tanggal as number) : undefined;
      if (!kecualikan.length && !nominal.length && !tanggalJatuhTempo) return { intent: "bantuan" };
      return {
        intent: "koreksi_draft",
        ...(kecualikan.length ? { kecualikan } : {}),
        ...(nominal.length ? { nominal } : {}),
        ...(tanggalJatuhTempo ? { tanggalJatuhTempo } : {}),
      };
    }
    default:
      return { intent: "bantuan" };
  }
}

const bersih = (teks: string) => teks.trim().toLowerCase().replace(/[.!?,]+$/g, "").replace(/\s+/g, " ");

/** Perintah pendek yang pasti maknanya — tidak perlu LLM. */
export function parseCepat(teks: string): Intent | null {
  const t = bersih(teks);
  const kode = /^(?:(ya|iya|y|ok|oke|setuju|lanjut|kirim|gas|yes)|(batal|batalkan|tidak|cancel|no)) #?(\d{6})$/.exec(t);
  if (kode) return { intent: "konfirmasi", setuju: !!kode[1], kode: kode[3] };
  if (/^(ya|iya|y|ok|oke|setuju|lanjut|kirim|gas|yes)( (kirim|dong|aja|saja))?$/.test(t)) return { intent: "konfirmasi", setuju: true };
  if (/^(batal|batalkan|tidak|nggak|gak|ga|jangan|no|cancel)( (dulu|aja|saja|kirim))?$/.test(t)) return { intent: "konfirmasi", setuju: false };
  if (/^(ganti|pilih|pindah) (kos|workspace)$/.test(t)) return { intent: "ganti_kos" };
  return null;
}

/**
 * Permintaan mengubah status bayar lewat chat ("tandai A05 lunas", "anggap sudah bayar", "lunasin").
 * Kosta selalu menolaknya: Lunas hanya dari pembayaran yang terverifikasi payment gateway.
 */
export function mintaTandaiLunas(teks: string) {
  const t = bersih(teks);
  return (
    /\b(tandai|tandain|jadikan|jadiin|set|ubah|ganti|update|anggap|catat|konfirmasi)\b.{0,40}\b(lunas|sudah bayar|udah bayar|sudah dibayar|paid)\b/.test(t) ||
    /\blunas(kan|in)\b/.test(t)
  );
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

/** "600rb" / "600 ribu" / "650.000" / "1,2jt" → rupiah; null bila bukan nominal. */
export function parseRupiah(teks: string) {
  const m = /^(?:rp\.?\s*)?(\d+(?:[.,]\d+)*)\s*(rb|ribu|k|jt|juta)?$/i.exec(teks.trim());
  if (!m) return null;
  const satuan = m[2]?.toLowerCase();
  const angka = satuan
    ? Number(m[1].replace(",", "."))
    : Number(m[1].replace(/[.,]/g, ""));
  const kali = satuan === "jt" || satuan === "juta" ? 1_000_000 : satuan ? 1_000 : 1;
  const hasil = Math.round(angka * kali);
  return Number.isFinite(hasil) && hasil > 0 ? hasil : null;
}

// "rp750" bukan nomor kamar.
const KAMAR = String.raw`(?!rp)[a-z]{1,2}\s?-?\d{1,3}`;

/** Koreksi draft dari kalimat owner; null bila bukan koreksi. */
export function parseKoreksi(teks: string) {
  const t = bersih(teks);
  const nominal = [...t.matchAll(new RegExp(`\\b(${KAMAR})\\s+(?:jadi|=)\\s+((?:rp\\.?\\s*)?\\d+(?:[.,]\\d+)*\\s*(?:rb|ribu|k|jt|juta)?)`, "g"))].flatMap(
    (m) => {
      const nomorKamar = normalisasiKamar(m[1]);
      const nilai = parseRupiah(m[2]);
      return nomorKamar && nilai ? [{ nomorKamar, nominal: nilai }] : [];
    },
  );
  const kecualikan = /\b(kecualikan|tanpa|hapus|keluarkan|coret)\b/.test(t)
    ? [...t.matchAll(new RegExp(`\\b(${KAMAR})\\b(?!\\s+(?:jadi|=))`, "g"))]
        .map((m) => normalisasiKamar(m[1]))
        .filter((k): k is string => !!k)
    : [];
  const tanggal = /jatuh tempo\s*(?:jadi\s*|ke\s*)?(?:tanggal|tgl)\.?\s*(\d{1,2})\b/.exec(t);
  const intent = validasiIntent({
    intent: "koreksi_draft",
    kecualikan,
    nominal,
    tanggalJatuhTempo: tanggal ? Number(tanggal[1]) : undefined,
  });
  return intent.intent === "koreksi_draft" ? intent : null;
}

/** Cadangan tanpa LLM: kata kunci sederhana. */
export function parseKataKunci(teks: string, hariIni: string): Intent {
  const t = bersih(teks);
  const koreksi = parseKoreksi(t);
  if (koreksi) return koreksi;
  const periode = periodeDariTeks(t, hariIni);
  const p = periode ? { periode } : {};
  const kamarDisebut = [...t.matchAll(new RegExp(`\\b(${KAMAR})\\b`, "g"))].map((m) => normalisasiKamar(m[1])).filter((k): k is string => !!k);

  if (/\bpindah(kan)?\b/.test(t) && kamarDisebut.length >= 2) {
    return validasiIntent({ intent: "pindah_penghuni", dariKamar: kamarDisebut[0], keKamar: kamarDisebut[1] });
  }
  if (/remind|ingatkan|pengingat|tagih yang/.test(t)) return validasiIntent({ intent: "siapkan_reminder", kamar: kamarDisebut });
  if (/(buat|bikin|siapkan|terbitkan).*tagihan|draft tagihan/.test(t)) return { intent: "draft_tagihan", ...p };
  if (kamarDisebut.length === 1 && /bayar|lunas|tagihan|status/.test(t)) {
    return { intent: "cek_kamar", nomorKamar: kamarDisebut[0], ...p };
  }
  if (/tunggak|nunggak|belum bayar|belum lunas|jatuh tempo|telat/.test(t)) return { intent: "lihat_tunggakan", ...p };
  if (/kosong|belum terisi|kamar (yang )?(masih )?tersedia/.test(t)) return { intent: "kamar_kosong" };
  if (/rekap|pemasukan|pendapatan|uang masuk|omzet/.test(t)) {
    return /(minggu|pekan) ini/.test(t) ? { intent: "rekap_pemasukan", rentang: "minggu_ini" } : { intent: "rekap_pemasukan", ...p };
  }
  return { intent: "bantuan" };
}
