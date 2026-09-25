// Midtrans Core API:
// - buat transaksi QRIS / Virtual Account (POST /v2/charge) untuk halaman bayar penyewa;
// - notifikasi HTTP → NotifikasiPembayaran. Tanda tangan: SHA-512(order_id + status_code +
//   gross_amount + ServerKey) di field signature_key. order_id = "<invoiceId>" atau "<invoiceId>~<percobaan>".

import { createHash, timingSafeEqual } from "node:crypto";

import type { GatewayPembayaran, PermintaanTransaksi, TransaksiGateway } from "./gateway.ts";

export type NotifikasiPembayaran = {
  provider: string;
  /** Unik per perubahan status transaksi — notifikasi yang sama dikirim ulang punya eventId sama. */
  eventId: string;
  /** ID transaksi di gateway (payments.referensi_provider). */
  referensi: string;
  /** order_id asli — cocok dengan payment_attempts.order_id bila transaksinya dibuat Kostera. */
  orderId: string;
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
    orderId: order_id,
    invoiceId: invoiceIdDariOrder(order_id),
    status: statusDari(body),
    statusGateway: transaction_status,
    nominal,
    metode: metodeBayar(body),
    waktu: waktuMidtrans(body.settlement_time ?? body.transaction_time),
    payload: body,
  };
}

const BANK_VA = { va_bca: "bca", va_bni: "bni", va_bri: "bri", va_permata: "permata" } as const;

function bodyCharge({ orderId, nominal, metode, masaBerlakuMenit }: PermintaanTransaksi) {
  const dasar = {
    transaction_details: { order_id: orderId, gross_amount: nominal },
    custom_expiry: { expiry_duration: masaBerlakuMenit, unit: "minute" },
  };
  if (metode === "qris") return { ...dasar, payment_type: "qris", qris: { acquirer: "gopay" } };
  // VA Mandiri di Midtrans = Mandiri Bill Payment: kode perusahaan (biller) + kode bayar (bill key).
  if (metode === "va_mandiri") {
    return { ...dasar, payment_type: "echannel", echannel: { bill_info1: "Pembayaran:", bill_info2: "Sewa kos" } };
  }
  return { ...dasar, payment_type: "bank_transfer", bank_transfer: { bank: BANK_VA[metode] } };
}

const teks = (nilai: unknown) => (typeof nilai === "string" && nilai ? nilai : undefined);

/** Respons charge → instruksi; null bila field wajib metodenya tidak ada. */
function bacaCharge(data: Record<string, unknown>, p: PermintaanTransaksi): TransaksiGateway | null {
  const referensi = teks(data.transaction_id);
  if (!referensi) return null;
  const kedaluwarsaPada = teks(data.expiry_time)
    ? waktuMidtrans(data.expiry_time)
    : new Date(Date.now() + p.masaBerlakuMenit * 60_000);
  if (p.metode === "qris") {
    const qrString = teks(data.qr_string);
    return qrString ? { referensi, kedaluwarsaPada, qrString } : null;
  }
  if (p.metode === "va_mandiri") {
    const nomorVa = teks(data.bill_key);
    const kodePerusahaan = teks(data.biller_code);
    return nomorVa && kodePerusahaan ? { referensi, kedaluwarsaPada, nomorVa, kodePerusahaan } : null;
  }
  const va = Array.isArray(data.va_numbers) ? (data.va_numbers[0] as { va_number?: unknown } | undefined) : undefined;
  const nomorVa = teks(va?.va_number) ?? teks(data.permata_va_number);
  return nomorVa ? { referensi, kedaluwarsaPada, nomorVa } : null;
}

export function buatGatewayMidtrans({
  serverKey,
  produksi = false,
  fetch: f = fetch,
}: {
  serverKey: string;
  produksi?: boolean;
  fetch?: typeof fetch;
}): GatewayPembayaran {
  const url = `https://api${produksi ? "" : ".sandbox"}.midtrans.com/v2/charge`;
  const otorisasi = `Basic ${Buffer.from(`${serverKey}:`).toString("base64")}`;
  return {
    provider: "midtrans",
    simulasi: false,
    async buatTransaksi(permintaan) {
      const res = await f(url, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: otorisasi },
        body: JSON.stringify(bodyCharge(permintaan)),
        signal: AbortSignal.timeout(15_000),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      // Transaksi QRIS/VA yang berhasil dibuat berstatus pending (status_code "201").
      const hasil = String(data.status_code) === "201" ? bacaCharge(data, permintaan) : null;
      if (!hasil) {
        throw new Error(`Midtrans ${String(data.status_code ?? res.status)}: ${teks(data.status_message) ?? "respons tidak lengkap"}`);
      }
      return hasil;
    },
  };
}
