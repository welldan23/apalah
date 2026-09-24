// Adapter pengiriman WhatsApp. Semua pesan keluar lewat satu antarmuka supaya provider
// bisa diganti lewat env WHATSAPP_PROVIDER tanpa mengubah pemanggil:
// - "log" (default): tidak mengirim apa pun, hanya mencatat ke log server — untuk pengembangan.
// - "waha" / "meta": ditambahkan bersama integrasi WhatsApp.

export type PesanWhatsApp = { ke: string; teks: string };
export type HasilKirim = { ok: true } | { ok: false; galat: string };

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

export function getPengirimWhatsApp(): PengirimWhatsApp {
  const provider = process.env.WHATSAPP_PROVIDER ?? "log";
  if (provider === "log") return pengirimLog;
  throw new Error(`WHATSAPP_PROVIDER "${provider}" belum didukung`);
}
