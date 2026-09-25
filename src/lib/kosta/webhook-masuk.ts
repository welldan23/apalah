// Penerimaan webhook WhatsApp (POST /api/webhook/whatsapp) tanpa ketergantungan Next.js supaya bisa
// diuji: ukuran → tanda tangan HMAC → JSON → normalisasi → simpan idempoten. Setiap panggilan, diterima
// maupun ditolak, dicatat di wa_webhook_events (tanpa isi pesan & nomor) untuk audit dan kesehatan provider.

import { schema, type Db } from "../../db/index.ts";
import { bacaPesanMasuk, tandaTanganValid } from "../whatsapp/webhook.ts";
import { simpanPesanMasuk, type PesanTersimpan } from "./terima-pesan.ts";

export const UKURAN_MAKS_WEBHOOK = 512 * 1024;

type StatusEvent = "diterima" | "tanda_tangan_invalid" | "payload_invalid" | "terlalu_besar";

/** Provider dari header tanda tangan: Meta (X-Hub-Signature-256) atau WAHA (X-Webhook-Hmac). */
export function providerWebhook(headers: Headers) {
  if (headers.has("x-hub-signature-256")) return "meta" as const;
  if (headers.has("x-webhook-hmac")) return "waha" as const;
  return "tidak_diketahui" as const;
}

export async function catatEventWebhook(
  db: Pick<Db, "insert">,
  e: { headers: Headers; status: StatusEvent; jumlahPesan?: number; pesanBaru?: number; idPesanProvider?: string[] },
) {
  try {
    await db.insert(schema.waWebhookEvents).values({
      provider: providerWebhook(e.headers),
      status: e.status,
      jumlahPesan: e.jumlahPesan ?? 0,
      pesanBaru: e.pesanBaru ?? 0,
      idPesanProvider: (e.idPesanProvider ?? []).slice(0, 20),
    });
  } catch (err) {
    console.error(`[whatsapp] event webhook ${e.status} gagal dicatat:`, err);
  }
}

export type HasilWebhook = { http: number; body: Record<string, unknown>; baru: PesanTersimpan[] };

export async function terimaWebhookWhatsApp(
  db: Db,
  { isi, headers, rahasia }: { isi: Buffer; headers: Headers; rahasia: string | undefined },
): Promise<HasilWebhook> {
  const tolak = async (status: StatusEvent, http: number, error: string): Promise<HasilWebhook> => {
    await catatEventWebhook(db, { headers, status });
    return { http, body: { error }, baru: [] };
  };
  if (isi.length > UKURAN_MAKS_WEBHOOK) return tolak("terlalu_besar", 413, "Payload terlalu besar.");
  if (!tandaTanganValid(isi, headers, rahasia)) return tolak("tanda_tangan_invalid", 401, "Tanda tangan tidak valid.");

  let body: unknown;
  try {
    body = JSON.parse(isi.toString("utf8"));
  } catch {
    return tolak("payload_invalid", 400, "Body harus JSON.");
  }

  const pesan = bacaPesanMasuk(body);
  const baru = await simpanPesanMasuk(db, pesan);
  await catatEventWebhook(db, {
    headers,
    status: "diterima",
    jumlahPesan: pesan.length,
    pesanBaru: baru.length,
    idPesanProvider: pesan.map((p) => p.idProvider),
  });
  return { http: 200, body: { diterima: pesan.length, baru: baru.length }, baru };
}
