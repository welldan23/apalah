// Webhook pesan masuk WhatsApp untuk Kosta.
// POST: payload WAHA atau Meta Cloud API, wajib bertanda tangan HMAC (WHATSAPP_WEBHOOK_SECRET).
//       Pesan teks disimpan ke percakapan per nomor (idempoten per ID pesan provider), langsung dibalas
//       200 agar provider tidak mengirim ulang; Kosta memproses & membalas lewat WhatsApp setelah
//       respons terkirim (after). Setiap panggilan dicatat di wa_webhook_events (lihat webhook-masuk).
// GET:  verifikasi langganan webhook Meta (WHATSAPP_VERIFY_TOKEN).

import { after, type NextRequest } from "next/server";

import { getDb } from "@/db";
import { getDepsKosta } from "@/lib/kosta/deps";
import { prosesPesanKosta } from "@/lib/kosta/proses-pesan";
import { catatEventWebhook, terimaWebhookWhatsApp, UKURAN_MAKS_WEBHOOK } from "@/lib/kosta/webhook-masuk";
import { tantanganMeta } from "@/lib/whatsapp/webhook";

export async function POST(request: Request) {
  const db = await getDb();
  // Tolak sebelum membaca body bila ukurannya sudah jelas terlalu besar.
  if (Number(request.headers.get("content-length") ?? 0) > UKURAN_MAKS_WEBHOOK) {
    await catatEventWebhook(db, { headers: request.headers, status: "terlalu_besar" });
    return Response.json({ error: "Payload terlalu besar." }, { status: 413 });
  }
  const { http, body, baru } = await terimaWebhookWhatsApp(db, {
    isi: Buffer.from(await request.arrayBuffer()),
    headers: request.headers,
    rahasia: process.env.WHATSAPP_WEBHOOK_SECRET,
  });
  if (baru.length > 0) {
    after(async () => {
      try {
        const deps = getDepsKosta(request);
        // Berurutan supaya balasan sampai sesuai urutan pesan.
        for (const p of baru) {
          await prosesPesanKosta(db, { conversationId: p.conversationId, messageId: p.messageId, teks: p.teks, saluran: "whatsapp" }, deps);
        }
      } catch (err) {
        console.error("Gagal memproses pesan WhatsApp:", err);
      }
    });
  }
  return Response.json(body, { status: http });
}

export function GET(request: NextRequest) {
  const tantangan = tantanganMeta(request.nextUrl.searchParams, process.env.WHATSAPP_VERIFY_TOKEN);
  if (tantangan === null) return new Response("Forbidden", { status: 403 });
  return new Response(tantangan, { headers: { "Content-Type": "text/plain" } });
}
