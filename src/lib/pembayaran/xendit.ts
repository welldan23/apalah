// Xendit Payments API v3 (api-version 2024-11-11), atas nama sub-akun xenPlatform milik kos:
// - buat transaksi QRIS / Virtual Account (POST /v3/payment_requests, header for-user-id) untuk
//   halaman bayar penyewa — uangnya masuk ke saldo sub-akun kos, bukan ke akun Kostera;
// - webhook: token x-callback-token dicocokkan dengan XENDIT_WEBHOOK_TOKEN, lalu status pembayaran
//   SELALU dibaca ulang dari API Xendit (GET) — isi webhook hanya dipakai sebagai petunjuk ID.
// Biaya transaksi dipotong Xendit dari saldo sub-akun yang menerima uang (biaya ditanggung owner).

import { createHash, timingSafeEqual } from "node:crypto";

import {
  invoiceIdDariOrder,
  type GatewayPembayaran,
  type NotifikasiPembayaran,
  type PermintaanTransaksi,
  type TransaksiGateway,
} from "./gateway.ts";
import type { IdMetodeBayar } from "./metode.ts";

const API = "https://api.xendit.co";
const VERSI_API = "2024-11-11";

const CHANNEL: Record<IdMetodeBayar, string> = {
  qris: "QRIS",
  va_bca: "BCA_VIRTUAL_ACCOUNT",
  va_bni: "BNI_VIRTUAL_ACCOUNT",
  va_bri: "BRI_VIRTUAL_ACCOUNT",
  va_mandiri: "MANDIRI_VIRTUAL_ACCOUNT",
  va_permata: "PERMATA_VIRTUAL_ACCOUNT",
};

const LABEL_CHANNEL: Record<string, string> = {
  QRIS: "QRIS",
  BCA_VIRTUAL_ACCOUNT: "VA BCA",
  BNI_VIRTUAL_ACCOUNT: "VA BNI",
  BRI_VIRTUAL_ACCOUNT: "VA BRI",
  MANDIRI_VIRTUAL_ACCOUNT: "VA Mandiri",
  PERMATA_VIRTUAL_ACCOUNT: "VA Permata",
};

type AksesXendit = { secretKey: string; fetch?: typeof fetch };

const header = ({ secretKey }: AksesXendit, akunId: string) => ({
  Accept: "application/json",
  "Content-Type": "application/json",
  Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
  "api-version": VERSI_API,
  "for-user-id": akunId,
});

const teks = (nilai: unknown) => (typeof nilai === "string" && nilai ? nilai : undefined);
const objek = (nilai: unknown) => (nilai && typeof nilai === "object" && !Array.isArray(nilai) ? (nilai as Record<string, unknown>) : {});

/** Nama penerima di VA: Xendit hanya menerima huruf, angka, spasi, dan . , ' (tidak diawali spasi). */
export function namaPenerimaVa(nama: string | undefined) {
  const bersih = (nama ?? "").replace(/[^a-zA-Z0-9 .,']/g, " ").replace(/\s+/g, " ").trim().slice(0, 40).trim();
  return bersih || "Kostera";
}

function bodyPermintaan({ orderId, nominal, metode, masaBerlakuMenit, namaPenerima }: PermintaanTransaksi, sekarang: Date) {
  const expiresAt = new Date(sekarang.getTime() + masaBerlakuMenit * 60_000).toISOString();
  return {
    reference_id: orderId,
    type: "PAY",
    country: "ID",
    currency: "IDR",
    request_amount: nominal,
    capture_method: "AUTOMATIC",
    channel_code: CHANNEL[metode],
    channel_properties: { expires_at: expiresAt, ...(metode !== "qris" && { display_name: namaPenerimaVa(namaPenerima) }) },
    description: "Pembayaran sewa kos",
  };
}

/** Respons payment request → instruksi; null bila isi QR / nomor VA tidak ada. */
function bacaPermintaan(data: Record<string, unknown>, p: PermintaanTransaksi, sekarang: Date): TransaksiGateway | null {
  const referensi = teks(data.payment_request_id);
  if (!referensi) return null;
  const aksi = (Array.isArray(data.actions) ? data.actions : []).map(objek);
  const nilai = (descriptor: string) => teks(aksi.find((a) => a.descriptor === descriptor)?.value);
  const batas = teks(objek(data.channel_properties).expires_at);
  const kedaluwarsaPada =
    batas && !Number.isNaN(Date.parse(batas)) ? new Date(batas) : new Date(sekarang.getTime() + p.masaBerlakuMenit * 60_000);
  if (p.metode === "qris") {
    const qrString = nilai("QR_STRING");
    return qrString ? { referensi, kedaluwarsaPada, qrString } : null;
  }
  const nomorVa = nilai("VIRTUAL_ACCOUNT_NUMBER");
  return nomorVa ? { referensi, kedaluwarsaPada, nomorVa } : null;
}

const galatXendit = (status: number, data: Record<string, unknown>) =>
  new Error(`Xendit ${status}: ${teks(data.error_code) ?? "respons tidak lengkap"}${teks(data.message) ? ` — ${data.message}` : ""}`);

export function buatGatewayXendit(akses: AksesXendit): GatewayPembayaran {
  const f = akses.fetch ?? fetch;
  return {
    provider: "xendit",
    simulasi: false,
    async buatTransaksi(permintaan) {
      // Tanpa sub-akun uangnya akan masuk ke akun Kostera — tidak boleh.
      if (!permintaan.akunId) throw new Error("Xendit: sub-akun kos belum diatur");
      const sekarang = new Date();
      const res = await f(`${API}/v3/payment_requests`, {
        method: "POST",
        headers: header(akses, permintaan.akunId),
        body: JSON.stringify(bodyPermintaan(permintaan, sekarang)),
        signal: AbortSignal.timeout(15_000),
      });
      const data = objek(await res.json().catch(() => ({})));
      const hasil = res.ok ? bacaPermintaan(data, permintaan, sekarang) : null;
      if (!hasil) throw galatXendit(res.status, data);
      return hasil;
    },
  };
}

const sha256 = (nilai: string) => createHash("sha256").update(nilai).digest();

/** Header x-callback-token sama dengan token webhook dari dashboard Xendit; tanpa token, semua ditolak. */
export function tokenWebhookXenditValid(diterima: string | null, token: string | undefined) {
  if (!token || !diterima) return false;
  return timingSafeEqual(sha256(diterima), sha256(token));
}

/** Event webhook yang diproses; event lain (refund, token, dll.) dijawab 200 dan diabaikan. */
export const EVENT_XENDIT = ["payment.capture", "payment.authorization", "payment.failure", "payment_request.expiry"] as const;
export type EventXendit = (typeof EVENT_XENDIT)[number];

/** Petunjuk dari isi webhook — belum dipercaya sampai dibaca ulang dari API. null = bukan event kita. */
export function bacaWebhookXendit(body: Record<string, unknown>) {
  const event = EVENT_XENDIT.find((e) => e === body.event);
  const data = objek(body.data);
  const paymentRequestId = teks(data.payment_request_id);
  if (!event || !paymentRequestId) return null;
  const paymentId = teks(data.payment_id);
  if (event !== "payment_request.expiry" && !paymentId) return null;
  return { event, paymentRequestId, paymentId };
}

/**
 * Baca pembayaran (atau payment request untuk event kedaluwarsa) langsung dari API Xendit atas nama
 * sub-akun kos. null bila tidak ditemukan di sub-akun itu; galat jaringan/server dilempar supaya
 * webhook dijawab 500 dan Xendit mengirim ulang.
 */
export async function ambilDariXendit(akses: AksesXendit, jalur: string, akunId: string) {
  const f = akses.fetch ?? fetch;
  const res = await f(`${API}${jalur}`, { headers: header(akses, akunId), signal: AbortSignal.timeout(15_000) });
  const data = objek(await res.json().catch(() => ({})));
  if (res.status === 404) return null;
  if (!res.ok) throw galatXendit(res.status, data);
  return data;
}

const angka = (nilai: unknown) => Math.round(Number(nilai));

function statusDari(event: EventXendit, status: string): NotifikasiPembayaran["status"] {
  if (event === "payment_request.expiry") return status === "EXPIRED" ? "kedaluwarsa" : "abaikan";
  if (status === "SUCCEEDED") return "berhasil";
  if (status === "AUTHORIZED" || status === "PENDING") return "pending";
  if (status === "FAILED" || status === "CANCELED") return "gagal";
  if (status === "EXPIRED") return "kedaluwarsa";
  return "abaikan";
}

/**
 * Objek terverifikasi dari API → notifikasi. `data` = pembayaran (GET /v3/payments/{id}) atau payment
 * request (event kedaluwarsa). null bila isinya tidak lengkap.
 */
export function notifikasiXendit(event: EventXendit, data: Record<string, unknown>): NotifikasiPembayaran | null {
  const referensi = teks(data.payment_request_id);
  const orderId = teks(data.reference_id);
  const status = teks(data.status);
  if (!referensi || !orderId || !status) return null;
  const tangkap = (Array.isArray(data.captures) ? data.captures : []).map(objek);
  const nominal = tangkap.length ? tangkap.reduce((n, c) => n + angka(c.capture_amount), 0) : angka(data.request_amount);
  if (!Number.isFinite(nominal) || nominal <= 0) return null;
  const waktu = teks(tangkap[0]?.capture_timestamp) ?? teks(data.updated);
  const channel = teks(data.channel_code) ?? "";
  return {
    provider: "xendit",
    eventId: `${teks(data.payment_id) ?? referensi}:${status}`,
    referensi,
    orderId,
    invoiceId: invoiceIdDariOrder(orderId),
    status: statusDari(event, status),
    statusGateway: status,
    nominal,
    metode: LABEL_CHANNEL[channel] ?? (channel || "Lainnya"),
    waktu: waktu && !Number.isNaN(Date.parse(waktu)) ? new Date(waktu) : new Date(),
    payload: data,
  };
}
