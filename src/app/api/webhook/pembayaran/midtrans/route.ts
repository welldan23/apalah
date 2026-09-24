// POST /api/webhook/pembayaran/midtrans — notifikasi HTTP Midtrans.
// Tanda tangan signature_key diverifikasi dengan MIDTRANS_SERVER_KEY; tanpa kunci, semua ditolak.
// Aman dikirim ulang (idempoten). 200 = sudah dicatat; galat server → 500 agar Midtrans mencoba lagi.
// Tagihan yang baru Lunas dikonfirmasi ke WhatsApp penyewa setelah respons terkirim (after).

import { after } from "next/server";

import { getDb } from "@/db";
import { kirimKonfirmasiLunas } from "@/lib/pembayaran/konfirmasi";
import { bacaNotifikasiMidtrans, tandaTanganMidtransValid } from "@/lib/pembayaran/midtrans";
import { prosesNotifikasiPembayaran } from "@/lib/pembayaran/proses-notifikasi";
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

  if (!tandaTanganMidtransValid(body, process.env.MIDTRANS_SERVER_KEY)) {
    return Response.json({ error: "Tanda tangan tidak valid." }, { status: 401 });
  }
  const notifikasi = bacaNotifikasiMidtrans(body);
  if (!notifikasi) return Response.json({ error: "Notifikasi tidak lengkap." }, { status: 400 });

  try {
    const db = await getDb();
    const hasil = await prosesNotifikasiPembayaran(db, notifikasi);
    if (!hasil.duplikat && hasil.statusInvoice === "lunas" && hasil.invoiceId) {
      const invoiceId = hasil.invoiceId;
      const baseUrl = process.env.APP_URL ?? new URL(request.url).origin;
      after(async () => {
        try {
          await kirimKonfirmasiLunas(db, invoiceId, { wa: getPengirimWhatsApp(), baseUrl });
        } catch (err) {
          console.error("Gagal mengirim konfirmasi lunas:", err);
        }
      });
    }
    return Response.json(hasil);
  } catch (err) {
    console.error("Gagal memproses notifikasi Midtrans:", err);
    return Response.json({ error: "Gagal memproses notifikasi." }, { status: 500 });
  }
}
