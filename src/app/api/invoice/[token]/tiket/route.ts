// Tiket keluhan penyewa lewat tautan invoice (tanpa login; token adalah aksesnya).
// GET  /api/invoice/[token]/tiket — tiket milik penyewa invoice itu, yang berjalan di atas.
// POST /api/invoice/[token]/tiket { kategori, deskripsi } — buat tiket baru berstatus Baru (201).

import { getDb } from "@/db";
import { bacaInputTiket, buatTiket } from "@/lib/aksi/tiket";
import { bacaJson, GalatAksi, responGalat } from "@/lib/aksi/galat";
import { HEADER_INVOICE_PUBLIK } from "@/lib/data/invoice-publik";
import { getTiketPenyewa } from "@/lib/data/tiket";

export async function GET(_: Request, ctx: RouteContext<"/api/invoice/[token]/tiket">) {
  try {
    const { token } = await ctx.params;
    const data = await getTiketPenyewa(await getDb(), token);
    if (!data) throw new GalatAksi("Tagihan tidak ditemukan.", 404);
    return Response.json({ tiket: data.tiket }, { headers: HEADER_INVOICE_PUBLIK });
  } catch (err) {
    return responGalat(err);
  }
}

export async function POST(request: Request, ctx: RouteContext<"/api/invoice/[token]/tiket">) {
  try {
    const { token } = await ctx.params;
    const input = bacaInputTiket(await bacaJson(request));
    const tiket = await buatTiket(await getDb(), token, input);
    return Response.json({ tiket }, { status: 201, headers: HEADER_INVOICE_PUBLIK });
  } catch (err) {
    return responGalat(err);
  }
}
