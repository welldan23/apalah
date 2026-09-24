// Webhook pesan masuk WhatsApp: verifikasi tanda tangan dan normalisasi payload provider
// (WAHA untuk lokal/pilot, Meta Cloud API untuk produksi) menjadi daftar PesanMasuk.
// Hanya pesan teks pribadi dari nomor lain yang diambil; grup, status, dan pesan sendiri diabaikan.

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { normalisasiNomorWa } from "../nomor-wa.ts";

export type PesanMasuk = {
  /** ID pesan dari provider (idempotensi). */
  idProvider: string;
  /** Nomor pengirim, format 628…. */
  dari: string;
  teks: string;
  waktu: Date;
};

const PANJANG_MAKS = 4000;

const sidik = (teks: string) => createHash("sha256").update(teks).digest();
const samaAman = (a: string, b: string) => timingSafeEqual(sidik(a), sidik(b));
const hmac = (algoritma: "sha256" | "sha512", rahasia: string, isi: Buffer) =>
  createHmac(algoritma, rahasia).update(isi).digest("hex");

/**
 * Tanda tangan HMAC body mentah:
 * - Meta: `X-Hub-Signature-256: sha256=<hex>` (kunci = App Secret);
 * - WAHA: `X-Webhook-Hmac: <hex>` SHA-512 (kunci = HMAC key webhook).
 * Tanpa rahasia di environment, semua ditolak.
 */
export function tandaTanganValid(isi: Buffer, headers: Headers, rahasia: string | undefined) {
  if (!rahasia) return false;
  const meta = headers.get("x-hub-signature-256");
  if (meta) return samaAman(meta.toLowerCase(), `sha256=${hmac("sha256", rahasia, isi)}`);
  const waha = headers.get("x-webhook-hmac");
  const algoritma = (headers.get("x-webhook-hmac-algorithm") ?? "sha512").toLowerCase();
  if (waha && algoritma === "sha512") return samaAman(waha.toLowerCase(), hmac("sha512", rahasia, isi));
  return false;
}

/** Jawaban verifikasi langganan webhook Meta (GET ?hub.mode=subscribe…); null bila ditolak. */
export function tantanganMeta(params: URLSearchParams, token: string | undefined) {
  const cocok =
    !!token &&
    params.get("hub.mode") === "subscribe" &&
    samaAman(params.get("hub.verify_token") ?? "", token);
  return cocok ? params.get("hub.challenge") : null;
}

const obj = (x: unknown): Record<string, unknown> =>
  x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : {};
const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
const teks = (x: unknown) => (typeof x === "string" ? x.trim().slice(0, PANJANG_MAKS) : "");
const waktuDetik = (x: unknown) => {
  const detik = Number(x);
  return Number.isFinite(detik) && detik > 0 ? new Date(detik * 1000) : new Date();
};

function dariMeta(body: Record<string, unknown>): PesanMasuk[] {
  return arr(body.entry).flatMap((entry) =>
    arr(obj(entry).changes).flatMap((change) =>
      arr(obj(obj(change).value).messages).flatMap((m) => {
        const pesan = obj(m);
        const dari = normalisasiNomorWa(teks(pesan.from));
        const isi = teks(obj(pesan.text).body);
        if (pesan.type !== "text" || !dari || !isi || typeof pesan.id !== "string") return [];
        return [{ idProvider: pesan.id, dari, teks: isi, waktu: waktuDetik(pesan.timestamp) }];
      }),
    ),
  );
}

function dariWaha(body: Record<string, unknown>): PesanMasuk[] {
  if (body.event !== "message") return [];
  const pesan = obj(body.payload);
  const jid = teks(pesan.from);
  // Hanya chat pribadi (…@c.us / …@s.whatsapp.net); grup (@g.us), status, dan @lid diabaikan.
  const pribadi = /^(\d+)@(c\.us|s\.whatsapp\.net)$/.exec(jid);
  const dari = pribadi ? normalisasiNomorWa(pribadi[1]) : null;
  const isi = teks(pesan.body);
  if (pesan.fromMe === true || !dari || !isi || typeof pesan.id !== "string") return [];
  return [{ idProvider: pesan.id, dari, teks: isi, waktu: waktuDetik(pesan.timestamp) }];
}

/** Payload webhook (Meta atau WAHA) → pesan teks masuk. Bentuk lain → daftar kosong. */
export function bacaPesanMasuk(body: unknown): PesanMasuk[] {
  const b = obj(body);
  if (b.object === "whatsapp_business_account") return dariMeta(b);
  if (typeof b.event === "string") return dariWaha(b);
  return [];
}
