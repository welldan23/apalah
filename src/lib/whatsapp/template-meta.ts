// Template WhatsApp resmi (Meta) yang dipakai Kostera — disusun dari kode yang sama dengan pengiriman
// (src/lib/pesan.ts), jadi isi yang didaftarkan selalu cocok dengan yang dikirim aplikasi.
// Pakai:
//   npm run meta:template            → tampilkan isi semua template (tanpa rahasia)
//   npm run meta:template -- daftar  → daftarkan ke WhatsApp Business Account (Graph API)
//   npm run meta:template -- cek     → status persetujuan tiap template
// `daftar` & `cek` butuh META_WA_TOKEN dan META_WABA_ID; tombol link memakai APP_URL (https).
// Token tidak pernah dicetak.

import { pathToFileURL } from "node:url";

import { MASA_BERLAKU_OTP_MENIT } from "../otp.ts";
import {
  TEMPLATE_LUNAS,
  TEMPLATE_PENGINGAT,
  TEMPLATE_PERLU_REVIEW,
  TEMPLATE_TAGIHAN,
  TEMPLATE_TIKET,
  templateLunas,
  templatePengingat,
  templatePerluReview,
  templateTagihan,
  templateTiket,
} from "../pesan.ts";
import type { TemplateWhatsApp } from "./index.ts";

export type TemplateMeta = {
  name: string;
  language: "id";
  category: "UTILITY" | "AUTHENTICATION";
  components: Record<string, unknown>[];
};

// Data contoh untuk kolom "example" yang diwajibkan Meta saat peninjauan.
const TAGIHAN_CONTOH = { namaPenghuni: "Rizky Ramadhan", nomorKamar: "A05", periode: "2026-09", nominal: 500_000, jatuhTempo: "2026-09-15" };
const TOKEN_CONTOH = "contoh-token-invoice";

/** Template Utility: isi + contoh variabel, plus satu tombol URL (dinamis `/invoice/{{1}}` atau statis). */
function utility(isi: string, contoh: TemplateWhatsApp, tombol: { teks: string; url: string }): TemplateMeta {
  const dinamis = tombol.url.endsWith("{{1}}");
  return {
    name: contoh.nama,
    language: "id",
    category: "UTILITY",
    components: [
      { type: "BODY", text: isi, example: { body_text: [contoh.variabel] } },
      {
        type: "BUTTONS",
        buttons: [
          {
            type: "URL",
            text: tombol.teks,
            url: tombol.url,
            ...(dinamis && { example: [tombol.url.replace("{{1}}", contoh.tombolUrl ?? "")] }),
          },
        ],
      },
    ],
  };
}

/** Semua template yang harus disetujui Meta sebelum WHATSAPP_PROVIDER=meta dipakai. */
export function daftarTemplateMeta(appUrl: string): TemplateMeta[] {
  const invoice = `${appUrl.replace(/\/+$/, "")}/invoice/{{1}}`;
  return [
    utility(TEMPLATE_TAGIHAN.isi, templateTagihan(TAGIHAN_CONTOH, "Kos Melati", TOKEN_CONTOH), { teks: "Lihat tagihan", url: invoice }),
    utility(
      TEMPLATE_PENGINGAT.sebelum.isi,
      templatePengingat(TAGIHAN_CONTOH, "Kos Melati", "2026-09-12", TOKEN_CONTOH),
      { teks: "Lihat tagihan", url: invoice },
    ),
    utility(
      TEMPLATE_PENGINGAT.lewat.isi,
      templatePengingat(TAGIHAN_CONTOH, "Kos Melati", "2026-09-24", TOKEN_CONTOH),
      { teks: "Lihat tagihan", url: invoice },
    ),
    utility(TEMPLATE_LUNAS.isi, templateLunas(TAGIHAN_CONTOH, "Kos Melati", TOKEN_CONTOH), { teks: "Lihat bukti bayar", url: invoice }),
    utility(
      TEMPLATE_TIKET.isi,
      templateTiket(
        { namaPenghuni: "Rizky Ramadhan", nomorTiket: "TK-012", jenis: "Air", nomorKamar: "A05", status: "diproses" },
        "Kos Melati",
        TOKEN_CONTOH,
      ),
      { teks: "Lihat status tiket", url: invoice },
    ),
    utility(
      TEMPLATE_PERLU_REVIEW.isi,
      templatePerluReview({ namaKos: "Kos Melati", nomorKamar: "A08", namaPenghuni: "Bagus Wicaksono", periode: "2026-09", nominal: 500_000, diterima: 450_000 }),
      { teks: "Periksa pembayaran", url: `${appUrl.replace(/\/+$/, "")}/pembayaran?status=perlu_review` },
    ),
    {
      // Isi template autentikasi baku dari Meta; {{1}} = kode, tombol "Salin kode".
      name: "kostera_kode_otp",
      language: "id",
      category: "AUTHENTICATION",
      components: [
        { type: "BODY", add_security_recommendation: true },
        { type: "FOOTER", code_expiration_minutes: MASA_BERLAKU_OTP_MENIT },
        { type: "BUTTONS", buttons: [{ type: "OTP", otp_type: "COPY_CODE", text: "Salin kode" }] },
      ],
    },
  ];
}

type AksesMeta = { token: string; wabaId: string; versi?: string; fetch?: typeof fetch };

const alamatTemplate = ({ wabaId, versi = "v23.0" }: AksesMeta) => `https://graph.facebook.com/${versi}/${wabaId}/message_templates`;
const galatMeta = (data: unknown) => {
  const e = (data as { error?: { message?: unknown; error_user_msg?: unknown } }).error;
  const pesan = e?.error_user_msg ?? e?.message;
  return typeof pesan === "string" ? pesan : "respons tidak dikenal";
};

/** Kirim tiap template ke Graph API; hasilnya satu baris ringkas per template. */
export async function daftarkanTemplateMeta(akses: AksesMeta, templates: TemplateMeta[]) {
  const ambil = akses.fetch ?? fetch;
  const hasil: string[] = [];
  for (const t of templates) {
    try {
      const res = await ambil(alamatTemplate(akses), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${akses.token}` },
        body: JSON.stringify(t),
        signal: AbortSignal.timeout(15_000),
      });
      const data = (await res.json().catch(() => ({}))) as { status?: unknown };
      hasil.push(res.ok ? `✓ ${t.name} → ${String(data.status ?? "terkirim")}` : `✗ ${t.name} → Meta: ${galatMeta(data)}`);
    } catch {
      hasil.push(`✗ ${t.name} → Graph API tidak bisa dihubungi`);
    }
  }
  return hasil;
}

/** Status persetujuan tiap template Kostera di WhatsApp Business Account. */
export async function cekTemplateMeta(akses: AksesMeta, templates: TemplateMeta[]) {
  const ambil = akses.fetch ?? fetch;
  const res = await ambil(`${alamatTemplate(akses)}?fields=name,status,language&limit=200`, {
    headers: { Authorization: `Bearer ${akses.token}` },
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json().catch(() => ({}))) as { data?: { name?: string; status?: string; language?: string }[] };
  if (!res.ok) return [`✗ Meta: ${galatMeta(data)}`];
  return templates.map((t) => {
    const ada = data.data?.find((d) => d.name === t.name && d.language === t.language);
    return ada?.status === "APPROVED" ? `✓ ${t.name} → APPROVED` : `✗ ${t.name} → ${ada?.status ?? "belum didaftarkan"}`;
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [perintah = "lihat"] = process.argv.slice(2);
  const env = process.env;
  const appUrl = env.APP_URL || "https://app.kostera.id";
  const templates = daftarTemplateMeta(appUrl);
  if (perintah === "lihat") {
    console.log(JSON.stringify(templates, null, 2));
  } else if (perintah === "daftar" || perintah === "cek") {
    if (!env.META_WA_TOKEN || !env.META_WABA_ID) {
      console.error("✗ Isi META_WA_TOKEN dan META_WABA_ID (WhatsApp Business Account ID) dulu.");
      process.exit(1);
    }
    if (perintah === "daftar" && !env.APP_URL?.startsWith("https://")) {
      console.error("✗ Isi APP_URL (https, mis. https://app.kostera.id) — dipakai tombol link di template.");
      process.exit(1);
    }
    const akses = { token: env.META_WA_TOKEN, wabaId: env.META_WABA_ID, versi: env.META_WA_API_VERSION || undefined };
    const baris = perintah === "daftar" ? await daftarkanTemplateMeta(akses, templates) : await cekTemplateMeta(akses, templates);
    for (const b of baris) console.log(b);
    process.exitCode = baris.some((b) => b.startsWith("✗")) ? 1 : 0;
  } else {
    console.error(`Perintah "${perintah}" tidak dikenal. Pakai: lihat | daftar | cek`);
    process.exit(1);
  }
}
