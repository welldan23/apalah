// GET /api/invoice/[token] — data satu invoice untuk penyewa, tanpa login (dipakai link invoice).
// Token berupa 18 byte acak (base64url) sehingga tidak bisa ditebak; token salah atau tidak ada
// sama-sama 404. Respons tidak di-cache dan tidak diindeks karena berisi data pribadi.

import { getDb } from "@/db";
import { getInvoicePublik } from "@/lib/data/invoice-publik";

const HEADER_PRIBADI = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
};

export async function GET(_: Request, ctx: RouteContext<"/api/invoice/[token]">) {
  const { token } = await ctx.params;
  const invoice = await getInvoicePublik(await getDb(), token);
  if (!invoice) {
    return Response.json({ error: "Invoice tidak ditemukan." }, { status: 404, headers: HEADER_PRIBADI });
  }
  return Response.json(invoice, { headers: HEADER_PRIBADI });
}
