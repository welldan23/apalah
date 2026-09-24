// Webhook pesan masuk WhatsApp untuk Kosta.
// POST: payload WAHA atau Meta Cloud API, wajib bertanda tangan HMAC (WHATSAPP_WEBHOOK_SECRET).
//       Pesan teks disimpan ke percakapan per nomor, langsung dibalas 200 agar provider tidak mengirim
//       ulang; Kosta memproses & membalas lewat WhatsApp setelah respons terkirim (after).
// GET:  verifikasi langganan webhook Meta (WHATSAPP_VERIFY_TOKEN).

import { after, type NextRequest } from "next/server";

import { getDb } from "@/db";
import { getDepsKosta } from "@/lib/kosta/deps";
import { prosesPesanKosta } from "@/lib/kosta/proses-pesan";
import { simpanPesanMasuk } from "@/lib/kosta/terima-pesan";
import { bacaPesanMasuk, tandaTanganValid, tantanganMeta } from "@/lib/whatsapp/webhook";

const UKURAN_MAKS = 512 * 1024;

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > UKURAN_MAKS) {
    return Response.json({ error: "Payload terlalu besar." }, { status: 413 });
  }
  const isi = Buffer.from(await request.arrayBuffer());
  if (isi.length > UKURAN_MAKS) return Response.json({ error: "Payload terlalu besar." }, { status: 413 });
  if (!tandaTanganValid(isi, request.headers, process.env.WHATSAPP_WEBHOOK_SECRET)) {
    return Response.json({ error: "Tanda tangan tidak valid." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(isi.toString("utf8"));
  } catch {
    return Response.json({ error: "Body harus JSON." }, { status: 400 });
  }

  const pesan = bacaPesanMasuk(body);
  const db = await getDb();
  const baru = await simpanPesanMasuk(db, pesan);
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
  return Response.json({ diterima: pesan.length, baru: baru.length });
}

export function GET(request: NextRequest) {
  const tantangan = tantanganMeta(request.nextUrl.searchParams, process.env.WHATSAPP_VERIFY_TOKEN);
  if (tantangan === null) return new Response("Forbidden", { status: 403 });
  return new Response(tantangan, { headers: { "Content-Type": "text/plain" } });
}
