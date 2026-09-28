// POST /api/invoice/[token]/bayar { metode } — buat (atau pakai ulang) transaksi QRIS / Virtual
// Account untuk sisa tagihan lewat payment gateway; balasannya InstruksiBayar + `simulasi`.
// Tanpa login: token link invoice adalah aksesnya. Status Lunas tetap hanya dari webhook gateway.

import { getDb } from "@/db";
import { bacaJson, responGalat } from "@/lib/aksi/galat";
import { HEADER_INVOICE_PUBLIK } from "@/lib/data/invoice-publik";
import { getGatewayPembayaran } from "@/lib/pembayaran/gateway";
import { bacaMetodeBayar, buatTransaksiBayar } from "@/lib/pembayaran/transaksi";

export async function POST(request: Request, ctx: RouteContext<"/api/invoice/[token]/bayar">) {
  try {
    const { token } = await ctx.params;
    const metode = bacaMetodeBayar(await bacaJson(request));
    const gateway = getGatewayPembayaran();
    const instruksi = await buatTransaksiBayar(await getDb(), token, metode, { gateway });
    return Response.json({ ...instruksi, simulasi: gateway.simulasi }, { headers: HEADER_INVOICE_PUBLIK });
  } catch (err) {
    return responGalat(err);
  }
}
