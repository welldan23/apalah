// Adapter WhatsApp Cloud API (Meta, resmi) — untuk produksi.
// POST https://graph.facebook.com/{versi}/{phoneNumberId}/messages dengan Authorization: Bearer {token}.
// Pesan yang dimulai bisnis (tagihan, pengingat) wajib template yang sudah disetujui; teks bebas
// hanya sampai bila penerima mengirim pesan dalam 24 jam terakhir (mis. balasan Kosta ke owner).

import type { PengirimWhatsApp, TemplateWhatsApp } from "./index.ts";

export type KonfigurasiMeta = {
  token: string;
  /** ID nomor pengirim di WhatsApp Manager (bukan nomor teleponnya). */
  phoneNumberId: string;
  versiApi?: string;
  /** Sandbox: bila diisi, pesan hanya dikirim ke nomor-nomor ini (format 628…). */
  nomorUji?: string[];
  /** Bisa diganti saat pengujian. */
  fetch?: typeof fetch;
};

const BATAS_WAKTU_MS = 10_000;

function isiTemplate(t: TemplateWhatsApp) {
  return {
    type: "template",
    template: {
      name: t.nama,
      language: { code: t.bahasa },
      components: [
        { type: "body", parameters: t.variabel.map((text) => ({ type: "text", text })) },
        ...(t.tombolUrl
          ? [{ type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: t.tombolUrl }] }]
          : []),
      ],
    },
  };
}

export function buatPengirimMeta({
  token,
  phoneNumberId,
  versiApi = "v23.0",
  nomorUji,
  fetch: ambil = fetch,
}: KonfigurasiMeta): PengirimWhatsApp {
  const alamat = `https://graph.facebook.com/${versiApi}/${phoneNumberId}/messages`;
  return {
    provider: "meta",
    simulasi: false,
    async kirim({ ke, teks, template }) {
      if (nomorUji && !nomorUji.includes(ke)) {
        return { ok: false, galat: "Nomor di luar daftar uji sandbox." };
      }
      const isi = template ? isiTemplate(template) : { type: "text", text: { body: teks, preview_url: true } };
      try {
        const res = await ambil(alamat, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: ke, ...isi }),
          signal: AbortSignal.timeout(BATAS_WAKTU_MS),
        });
        const data = (await res.json().catch(() => ({}))) as {
          messages?: { id?: unknown }[];
          error?: { message?: unknown; code?: unknown };
        };
        if (!res.ok) {
          const { message, code } = data.error ?? {};
          return {
            ok: false,
            galat:
              typeof message === "string"
                ? `Meta menolak pesan: ${message}${code ? ` (kode ${code})` : ""}.`
                : `Meta menolak pesan (HTTP ${res.status}).`,
          };
        }
        const id = data.messages?.[0]?.id;
        return { ok: true, ...(typeof id === "string" ? { id } : {}) };
      } catch {
        return { ok: false, galat: "Server WhatsApp Cloud API tidak bisa dihubungi." };
      }
    },
  };
}
