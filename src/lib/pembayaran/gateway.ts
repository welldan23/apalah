// Adapter payment gateway untuk membuat transaksi bayar (QRIS / Virtual Account). Semua pemanggil
// lewat satu antarmuka, seperti adapter WhatsApp:
// - Xendit (Payments API v3) bila XENDIT_SECRET_KEY diisi — kunci xnd_development_… = mode test,
//   xnd_production_… = uang sungguhan. Transaksi dibuat atas nama sub-akun xenPlatform milik kos;
// - "simulasi" tanpa kunci: nomor VA/QR contoh untuk pengembangan — tidak bisa dibayar.

import { createHash } from "node:crypto";

import type { IdMetodeBayar } from "./metode.ts";
import { buatGatewayXendit } from "./xendit.ts";

export type PermintaanTransaksi = {
  /** "<invoiceId>~<percobaan>" — unik per transaksi di gateway. */
  orderId: string;
  nominal: number;
  metode: IdMetodeBayar;
  masaBerlakuMenit: number;
  /** Sub-akun xenPlatform kos penerima uang (organizations.xendit_akun_id). */
  akunId?: string;
  /** Nama penerima yang tampil di aplikasi bank penyewa (nama kos). */
  namaPenerima?: string;
};

export type TransaksiGateway = {
  /** ID transaksi di gateway. */
  referensi: string;
  kedaluwarsaPada: Date;
  nomorVa?: string;
  qrString?: string;
};

export type GatewayPembayaran = {
  provider: string;
  /** true bila instruksinya contoh (tidak bisa dibayar). */
  simulasi: boolean;
  /** Melempar Error bila gateway menolak atau tidak bisa dihubungi. */
  buatTransaksi(permintaan: PermintaanTransaksi): Promise<TransaksiGateway>;
};

/** Notifikasi status pembayaran dari gateway yang sudah diverifikasi, siap diproses. */
export type NotifikasiPembayaran = {
  provider: string;
  /** Unik per perubahan status transaksi — notifikasi yang sama dikirim ulang punya eventId sama. */
  eventId: string;
  /** ID transaksi di gateway (payments.referensi_provider = payment_attempts.referensi_provider). */
  referensi: string;
  /** order_id asli — cocok dengan payment_attempts.order_id bila transaksinya dibuat Kostera. */
  orderId: string;
  invoiceId: string;
  status: "berhasil" | "pending" | "gagal" | "kedaluwarsa" | "abaikan";
  /** Status asli dari gateway, untuk catatan. */
  statusGateway: string;
  nominal: number;
  metode: string;
  waktu: Date;
  payload: Record<string, unknown>;
};

/** order_id "inv_123~2" → "inv_123". */
export const invoiceIdDariOrder = (orderId: string) => orderId.split("~")[0];

const gatewaySimulasi: GatewayPembayaran = {
  provider: "simulasi",
  simulasi: true,
  async buatTransaksi({ orderId, metode, masaBerlakuMenit }) {
    const referensi = `simulasi-${orderId}`;
    const kedaluwarsaPada = new Date(Date.now() + masaBerlakuMenit * 60_000);
    if (metode === "qris") return { referensi, kedaluwarsaPada, qrString: `KOSTERA-SIMULASI-${orderId}` };
    // Nomor VA contoh yang tetap untuk order yang sama.
    const angka = parseInt(createHash("sha256").update(orderId).digest("hex").slice(0, 12), 16) % 1e12;
    return { referensi, kedaluwarsaPada, nomorVa: `8808${String(angka).padStart(12, "0")}` };
  },
};

type Env = Partial<Record<string, string>>;

export function getGatewayPembayaran(env: Env = process.env): GatewayPembayaran {
  if (!env.XENDIT_SECRET_KEY) return gatewaySimulasi;
  return buatGatewayXendit({ secretKey: env.XENDIT_SECRET_KEY });
}
