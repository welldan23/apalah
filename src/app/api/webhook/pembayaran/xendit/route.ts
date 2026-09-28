// POST /api/webhook/pembayaran/xendit — webhook Payments API Xendit (pembayaran & kedaluwarsa).
// Token x-callback-token dicocokkan dengan XENDIT_WEBHOOK_TOKEN; tanpa token, semua ditolak. Status
// pembayaran dibaca ulang dari API Xendit sebelum diproses. Aman dikirim ulang (idempoten).
// 200 = sudah dicatat/diabaikan; galat server → 500 agar Xendit mencoba lagi.
// Setelah respons terkirim (after): tagihan yang baru Lunas dikonfirmasi ke WhatsApp penyewa dan
// owner/admin dikabari uang masuk; tagihan yang jadi Perlu review diberitahukan ke owner/admin.

import { after } from "next/server";

import { getDb } from "@/db";
import { kirimKonfirmasiLunas } from "@/lib/pembayaran/konfirmasi";
import { kirimNotifikasiPembayaranMasuk } from "@/lib/pembayaran/notifikasi-masuk";
import { kirimNotifikasiPerluReview } from "@/lib/pembayaran/notifikasi-review";
import { tanganiWebhookXendit } from "@/lib/pembayaran/webhook-xendit";
import { getPengirimWhatsApp } from "@/lib/whatsapp";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    const json = await request.json();
    if (!json || typeof json !== "object" || Array.isArray(json)) throw new Error();
    body = json;
  } catch {
    return Response.json({ error: "Body harus objek JSON." }, { status: 400 });
  }

  try {
    const db = await getDb();
    const hasil = await tanganiWebhookXendit(
      db,
      { body, token: request.headers.get("x-callback-token") },
      { secretKey: process.env.XENDIT_SECRET_KEY, tokenWebhook: process.env.XENDIT_WEBHOOK_TOKEN },
    );
    const { invoiceId, statusInvoice } = hasil;
    if (invoiceId && (statusInvoice === "lunas" || statusInvoice === "perlu_review")) {
      const baseUrl = process.env.APP_URL ?? new URL(request.url).origin;
      after(async () => {
        const deps = { wa: getPengirimWhatsApp(), baseUrl };
        const kirim = statusInvoice === "lunas"
          ? [kirimKonfirmasiLunas(db, invoiceId, deps), kirimNotifikasiPembayaranMasuk(db, invoiceId, deps)]
          : [kirimNotifikasiPerluReview(db, invoiceId, deps)];
        for (const h of await Promise.allSettled(kirim)) {
          if (h.status === "rejected") console.error("Gagal mengirim pesan setelah pembayaran:", h.reason);
        }
      });
    }
    return Response.json(hasil.body, { status: hasil.status });
  } catch (err) {
    console.error("Gagal memproses webhook Xendit:", err);
    return Response.json({ error: "Gagal memproses notifikasi." }, { status: 500 });
  }
}
