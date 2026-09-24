// Adapter pengiriman WhatsApp. Semua pesan keluar lewat satu antarmuka supaya provider
// bisa diganti lewat env WHATSAPP_PROVIDER tanpa mengubah pemanggil:
// - "log" (default): tidak mengirim apa pun, hanya mencatat ke log server — untuk pengembangan.
// - "waha": WAHA self-hosted untuk sandbox/pilot (WAHA_URL, WAHA_API_KEY, WAHA_SESSION);
//   WHATSAPP_NOMOR_UJI (dipisah koma) membatasi penerima selama uji coba.
// - "meta": Meta Cloud API/BSP resmi untuk produksi — ditambahkan bersama integrasinya.

import { normalisasiNomorWa } from "../nomor-wa.ts";
import { buatPengirimWaha } from "./waha.ts";

export type PesanWhatsApp = { ke: string; teks: string };
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

type Env = Partial<Record<string, string>>;

export function getPengirimWhatsApp(env: Env = process.env): PengirimWhatsApp {
  const provider = env.WHATSAPP_PROVIDER || "log";
  if (provider === "log") return pengirimLog;
  if (provider === "waha") {
    if (!env.WAHA_URL) throw new Error("WHATSAPP_PROVIDER=waha butuh WAHA_URL");
    const nomorUji = env.WHATSAPP_NOMOR_UJI?.split(",").flatMap((n) => normalisasiNomorWa(n) ?? []);
    return buatPengirimWaha({
      url: env.WAHA_URL,
      apiKey: env.WAHA_API_KEY || undefined,
      session: env.WAHA_SESSION || undefined,
      nomorUji: nomorUji?.length ? nomorUji : undefined,
    });
  }
  throw new Error(`WHATSAPP_PROVIDER "${provider}" belum didukung`);
}
