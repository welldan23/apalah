// Notifikasi HTTP Midtrans → NotifikasiPembayaran. Tanda tangan: SHA-512(order_id + status_code +
// gross_amount + ServerKey) di field signature_key. order_id = "<invoiceId>" atau "<invoiceId>~<percobaan>".

import { createHash, timingSafeEqual } from "node:crypto";

export type NotifikasiPembayaran = {
  provider: string;
  /** Unik per perubahan status transaksi — notifikasi yang sama dikirim ulang punya eventId sama. */
  eventId: string;
  /** ID transaksi di gateway (payments.referensi_provider). */
  referensi: string;
  invoiceId: string;
  status: "berhasil" | "pending" | "gagal" | "abaikan";
  /** Status asli dari gateway, untuk catatan. */
  statusGateway: string;
  nominal: number;
  metode: string;
  waktu: Date;
  payload: Record<string, unknown>;
};

const sha512 = (teks: string) => createHash("sha512").update(teks).digest();

export function tandaTanganMidtransValid(body: Record<string, unknown>, serverKey: string | undefined) {
  if (!serverKey || typeof body.signature_key !== "string") return false;
  const { order_id, status_code, gross_amount } = body;
  if (typeof order_id !== "string" || typeof status_code !== "string" || typeof gross_amount !== "string") return false;
  const harapan = sha512(`${order_id}${status_code}${gross_amount}${serverKey}`);
  const diterima = Buffer.from(body.signature_key, "hex");
  return diterima.length === harapan.length && timingSafeEqual(diterima, harapan);
}

/** order_id "inv_123~2" → "inv_123". */
export const invoiceIdDariOrder = (orderId: string) => orderId.split("~")[0];

function metodeBayar(body: Record<string, unknown>) {
  const jenis = String(body.payment_type ?? "");
  const va = Array.isArray(body.va_numbers) ? (body.va_numbers[0] as { bank?: string } | undefined) : undefined;
  if (jenis === "qris") return "QRIS";
  if (jenis === "bank_transfer" && va?.bank) return `VA ${va.bank.toUpperCase()}`;
  if (jenis === "echannel") return "VA Mandiri";
  if (jenis === "gopay") return "GoPay";
  if (jenis === "shopeepay") return "ShopeePay";
  if (jenis === "cstore") return String(body.store ?? "Gerai retail");
  return jenis || "Lainnya";
}

function statusDari(body: Record<string, unknown>): NotifikasiPembayaran["status"] {
  const status = String(body.transaction_status ?? "");
  if (status === "settlement") return "berhasil";
  if (status === "capture") return body.fraud_status === "accept" ? "berhasil" : "pending";
  if (status === "pending") return "pending";
  if (["deny", "cancel", "expire", "failure"].includes(status)) return "gagal";
  return "abaikan"; // refund, chargeback, dll. — ditangani manual
}

/** Waktu Midtrans "2026-09-24 10:15:00" (WIB) → Date. */
function waktuMidtrans(nilai: unknown) {
  if (typeof nilai !== "string" || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(nilai)) return new Date();
  return new Date(`${nilai.replace(" ", "T")}+07:00`);
}

/** null bila payload tidak lengkap. */
export function bacaNotifikasiMidtrans(body: Record<string, unknown>): NotifikasiPembayaran | null {
  const { order_id, transaction_id, transaction_status, gross_amount } = body;
  if (typeof order_id !== "string" || typeof transaction_id !== "string" || typeof transaction_status !== "string") return null;
  const nominal = Math.round(Number(gross_amount));
  if (!Number.isFinite(nominal) || nominal <= 0) return null;
  return {
    provider: "midtrans",
    eventId: `${transaction_id}:${transaction_status}`,
    referensi: transaction_id,
    invoiceId: invoiceIdDariOrder(order_id),
    status: statusDari(body),
    statusGateway: transaction_status,
    nominal,
    metode: metodeBayar(body),
    waktu: waktuMidtrans(body.settlement_time ?? body.transaction_time),
    payload: body,
  };
}
