// Adapter payment gateway untuk membuat transaksi bayar (QRIS / Virtual Account). Semua pemanggil
// lewat satu antarmuka, seperti adapter WhatsApp:
// - Midtrans Core API bila MIDTRANS_SERVER_KEY diisi (sandbox; MIDTRANS_PRODUCTION=true untuk produksi);
// - "simulasi" tanpa kunci: nomor VA/QR contoh untuk pengembangan — tidak bisa dibayar.

import { createHash } from "node:crypto";

import { buatGatewayMidtrans } from "./midtrans.ts";
import type { IdMetodeBayar } from "./metode.ts";

export type PermintaanTransaksi = {
  /** "<invoiceId>~<percobaan>" — unik per transaksi di gateway. */
  orderId: string;
  nominal: number;
  metode: IdMetodeBayar;
  masaBerlakuMenit: number;
};

export type TransaksiGateway = {
  /** ID transaksi di gateway. */
  referensi: string;
  kedaluwarsaPada: Date;
  nomorVa?: string;
  kodePerusahaan?: string;
  qrString?: string;
};

export type GatewayPembayaran = {
  provider: string;
  /** true bila instruksinya contoh (tidak bisa dibayar). */
  simulasi: boolean;
  /** Melempar Error bila gateway menolak atau tidak bisa dihubungi. */
  buatTransaksi(permintaan: PermintaanTransaksi): Promise<TransaksiGateway>;
};

const gatewaySimulasi: GatewayPembayaran = {
  provider: "simulasi",
  simulasi: true,
  async buatTransaksi({ orderId, metode, masaBerlakuMenit }) {
    const referensi = `simulasi-${orderId}`;
    const kedaluwarsaPada = new Date(Date.now() + masaBerlakuMenit * 60_000);
    if (metode === "qris") return { referensi, kedaluwarsaPada, qrString: `KOSTERA-SIMULASI-${orderId}` };
    // Nomor VA contoh yang tetap untuk order yang sama.
    const angka = parseInt(createHash("sha256").update(orderId).digest("hex").slice(0, 12), 16) % 1e12;
    const nomorVa = `8808${String(angka).padStart(12, "0")}`;
    return { referensi, kedaluwarsaPada, nomorVa, ...(metode === "va_mandiri" && { kodePerusahaan: "70012" }) };
  },
};

type Env = Partial<Record<string, string>>;

export function getGatewayPembayaran(env: Env = process.env): GatewayPembayaran {
  if (!env.MIDTRANS_SERVER_KEY) return gatewaySimulasi;
  return buatGatewayMidtrans({ serverKey: env.MIDTRANS_SERVER_KEY, produksi: env.MIDTRANS_PRODUCTION === "true" });
}
