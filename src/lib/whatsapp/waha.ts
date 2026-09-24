// Adapter WAHA (WhatsApp HTTP API, self-hosted) — untuk lokal, sandbox, dan pilot.
// Kirim teks: POST {url}/api/sendText { session, chatId: "628…@c.us", text } dengan header X-Api-Key.

import type { PengirimWhatsApp } from "./index.ts";

export type KonfigurasiWaha = {
  /** Alamat server WAHA, mis. http://localhost:3000. */
  url: string;
  apiKey?: string;
  session?: string;
  /** Sandbox: bila diisi, pesan hanya dikirim ke nomor-nomor ini (format 628…). */
  nomorUji?: string[];
  /** Bisa diganti saat pengujian. */
  fetch?: typeof fetch;
};

const BATAS_WAKTU_MS = 10_000;

export function buatPengirimWaha({
  url,
  apiKey,
  session = "default",
  nomorUji,
  fetch: ambil = fetch,
}: KonfigurasiWaha): PengirimWhatsApp {
  const alamat = `${url.replace(/\/+$/, "")}/api/sendText`;
  return {
    provider: "waha",
    simulasi: false,
    async kirim({ ke, teks }) {
      if (nomorUji && !nomorUji.includes(ke)) {
        return { ok: false, galat: "Nomor di luar daftar uji sandbox." };
      }
      try {
        const res = await ambil(alamat, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(apiKey ? { "X-Api-Key": apiKey } : {}) },
          body: JSON.stringify({ session, chatId: `${ke}@c.us`, text: teks }),
          signal: AbortSignal.timeout(BATAS_WAKTU_MS),
        });
        if (!res.ok) return { ok: false, galat: `WAHA menolak pesan (HTTP ${res.status}).` };
        const data = (await res.json().catch(() => ({}))) as { id?: unknown };
        const id = typeof data.id === "string" ? data.id : (data.id as { _serialized?: string })?._serialized;
        return { ok: true, ...(typeof id === "string" ? { id } : {}) };
      } catch {
        return { ok: false, galat: "Server WAHA tidak bisa dihubungi." };
      }
    },
  };
}
