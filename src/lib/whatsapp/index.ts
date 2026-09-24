// Adapter pengiriman WhatsApp. Semua pesan keluar lewat satu antarmuka supaya provider
// bisa diganti lewat env WHATSAPP_PROVIDER tanpa mengubah pemanggil:
// - "log" (default): tidak mengirim apa pun, hanya mencatat ke log server — untuk pengembangan.
// - "waha": WAHA self-hosted untuk sandbox/pilot (WAHA_URL, WAHA_API_KEY, WAHA_SESSION);
//   WHATSAPP_NOMOR_UJI (dipisah koma) membatasi penerima selama uji coba.
// - "meta": WhatsApp Cloud API resmi untuk produksi (META_WA_TOKEN, META_WA_PHONE_NUMBER_ID,
//   META_WA_API_VERSION opsional); pesan yang dimulai bisnis dikirim sebagai template.

import { normalisasiNomorWa } from "../nomor-wa.ts";
import { buatPengirimMeta } from "./meta.ts";
import { buatPengirimWaha } from "./waha.ts";

/**
 * Template resmi (Meta) untuk pesan yang dimulai bisnis, mis. pengingat ke penyewa.
 * Provider teks (log, WAHA) mengabaikannya dan mengirim `teks`.
 */
export type TemplateWhatsApp = {
  nama: string;
  /** Kode bahasa template, mis. "id". */
  bahasa: string;
  /** Nilai {{1}}, {{2}}, … di isi template. */
  variabel: string[];
  /** Akhiran URL untuk tombol URL dinamis pertama, bila templatenya punya. */
  tombolUrl?: string;
};

export type PesanWhatsApp = { ke: string; teks: string; template?: TemplateWhatsApp };
/** `id` = ID pesan dari provider, bila tersedia. */
export type HasilKirim = { ok: true; id?: string } | { ok: false; galat: string };

export type PengirimWhatsApp = {
  provider: string;
  /** true bila pesan tidak benar-benar sampai ke WhatsApp (mode pengembangan). */
  simulasi: boolean;
  kirim(pesan: PesanWhatsApp): Promise<HasilKirim>;
};

const pengirimLog: PengirimWhatsApp = {
  provider: "log",
  simulasi: true,
  async kirim({ ke, teks }) {
    console.info(`[whatsapp:log] → ${ke}: ${teks.slice(0, 80)}…`);
    return { ok: true };
  },
};

/** Kirim tanpa melempar: galat jaringan/provider menjadi `{ ok: false, galat }` supaya bisa dicatat. */
export async function kirimAman(wa: PengirimWhatsApp, pesan: PesanWhatsApp): Promise<HasilKirim> {
  try {
    return await wa.kirim(pesan);
  } catch (e) {
    return { ok: false, galat: e instanceof Error ? e.message : String(e) };
  }
}

type Env = Partial<Record<string, string>>;

export function getPengirimWhatsApp(env: Env = process.env): PengirimWhatsApp {
  const provider = env.WHATSAPP_PROVIDER || "log";
  if (provider === "log") return pengirimLog;
  const daftarUji = env.WHATSAPP_NOMOR_UJI?.split(",").flatMap((n) => normalisasiNomorWa(n) ?? []);
  const nomorUji = daftarUji?.length ? daftarUji : undefined;
  if (provider === "waha") {
    if (!env.WAHA_URL) throw new Error("WHATSAPP_PROVIDER=waha butuh WAHA_URL");
    return buatPengirimWaha({
      url: env.WAHA_URL,
      apiKey: env.WAHA_API_KEY || undefined,
      session: env.WAHA_SESSION || undefined,
      nomorUji,
    });
  }
  if (provider === "meta") {
    if (!env.META_WA_TOKEN || !env.META_WA_PHONE_NUMBER_ID) {
      throw new Error("WHATSAPP_PROVIDER=meta butuh META_WA_TOKEN dan META_WA_PHONE_NUMBER_ID");
    }
    return buatPengirimMeta({
      token: env.META_WA_TOKEN,
      phoneNumberId: env.META_WA_PHONE_NUMBER_ID,
      versiApi: env.META_WA_API_VERSION || undefined,
      nomorUji,
    });
  }
  throw new Error(`WHATSAPP_PROVIDER "${provider}" belum didukung`);
}
