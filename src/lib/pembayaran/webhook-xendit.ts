// Webhook Xendit → pemrosesan pembayaran. Tiga lapis pengaman sebelum invoice bisa Lunas:
// 1. token x-callback-token cocok dengan XENDIT_WEBHOOK_TOKEN;
// 2. hanya transaksi yang dibuat Kostera (payment_attempts) yang diproses;
// 3. status & nominal dibaca ulang dari API Xendit atas nama sub-akun penerima transaksi itu — isi
//    webhook tidak pernah dipercaya langsung.

import { eq } from "drizzle-orm";

import { schema, type Db } from "../../db/index.ts";
import { prosesNotifikasiPembayaran } from "./proses-notifikasi.ts";
import { ambilDariXendit, bacaWebhookXendit, notifikasiXendit, tokenWebhookXenditValid } from "./xendit.ts";

const { paymentAttempts } = schema;

export type HasilWebhookXendit = {
  status: number;
  body: Record<string, unknown>;
  /** Terisi bila pembayaran diproses — untuk mengirim WhatsApp setelah respons. */
  invoiceId?: string;
  statusInvoice?: string;
};

const diabaikan = (alasan: string): HasilWebhookXendit => ({ status: 200, body: { diabaikan: alasan } });

export async function tanganiWebhookXendit(
  db: Db,
  { body, token }: { body: Record<string, unknown>; token: string | null },
  { secretKey, tokenWebhook, fetch }: { secretKey?: string; tokenWebhook?: string; fetch?: typeof globalThis.fetch },
): Promise<HasilWebhookXendit> {
  if (!tokenWebhookXenditValid(token, tokenWebhook)) return { status: 401, body: { error: "Token webhook tidak valid." } };
  const petunjuk = bacaWebhookXendit(body);
  if (!petunjuk) return diabaikan("event tidak diproses");
  // 503 → Xendit mengirim ulang nanti, setelah kunci API dipasang.
  if (!secretKey) return { status: 503, body: { error: "Kunci API Xendit belum diatur." } };

  const [transaksi] = await db
    .select({ orderId: paymentAttempts.orderId, akunGateway: paymentAttempts.akunGateway })
    .from(paymentAttempts)
    .where(eq(paymentAttempts.referensiProvider, petunjuk.paymentRequestId));
  if (!transaksi?.akunGateway) return diabaikan("transaksi bukan buatan Kostera");

  const jalur =
    petunjuk.event === "payment_request.expiry"
      ? `/v3/payment_requests/${encodeURIComponent(petunjuk.paymentRequestId)}`
      : `/v3/payments/${encodeURIComponent(petunjuk.paymentId!)}`;
  const data = await ambilDariXendit({ secretKey, fetch }, jalur, transaksi.akunGateway);
  const n = data && notifikasiXendit(petunjuk.event, data);
  if (!n || n.referensi !== petunjuk.paymentRequestId || n.orderId !== transaksi.orderId) {
    console.warn(`[pembayaran] webhook Xendit ${petunjuk.event} untuk ${transaksi.orderId} tidak cocok dengan data di Xendit — diabaikan.`);
    return diabaikan("tidak terverifikasi di Xendit");
  }
  const hasil = await prosesNotifikasiPembayaran(db, n);
  return hasil.duplikat
    ? { status: 200, body: hasil }
    : { status: 200, body: hasil, invoiceId: hasil.invoiceId, statusInvoice: hasil.statusInvoice };
}
