// Buat transaksi bayar dari link invoice (POST /api/invoice/[token]/bayar) untuk SISA tagihan.
// Idempoten per tagihan + metode + nominal: selama transaksi yang sama masih berlaku, instruksi
// lamanya yang dikembalikan (muat ulang / klik dua kali tidak membuat VA baru). Baris invoice
// dikunci selama transaksi dibuat, jadi dua permintaan bersamaan tidak membuat dua transaksi.

import { and, desc, eq, gt, inArray, max, sql } from "drizzle-orm";

import { schema, type Db } from "../../db/index.ts";
import { GalatAksi } from "../aksi/galat.ts";
import { tokenValid } from "../data/invoice-publik.ts";
import type { GatewayPembayaran } from "./gateway.ts";
import { cariMetode, sisaTagihan, tagihanBisaDibayar, type IdMetodeBayar, type InstruksiBayar } from "./metode.ts";

const { invoices, paymentAttempts, payments } = schema;

/** Transaksi lama hanya dipakai ulang bila masih berlaku setidaknya selama ini. */
const SISA_BERLAKU_MINIMUM_MS = 60_000;

export const GALAT_GATEWAY = "Pembayaran online sedang bermasalah. Coba lagi sebentar lagi, atau pilih cara bayar lain.";

export function bacaMetodeBayar(body: Record<string, unknown>): IdMetodeBayar {
  const metode = typeof body.metode === "string" ? cariMetode(body.metode) : undefined;
  if (!metode) throw new GalatAksi("Pilih cara bayar yang tersedia.");
  return metode.id;
}

type BarisTransaksi = typeof paymentAttempts.$inferSelect;

const keInstruksi = (t: BarisTransaksi): InstruksiBayar => ({
  metode: t.metode as IdMetodeBayar,
  nominal: t.nominal,
  kedaluwarsaPada: t.kedaluwarsaPada.toISOString(),
  ...(t.nomorVa && { nomorVa: t.nomorVa }),
  ...(t.kodePerusahaan && { kodePerusahaan: t.kodePerusahaan }),
  ...(t.qrString && { qrString: t.qrString }),
});

export async function buatTransaksiBayar(
  db: Db,
  token: string,
  metode: IdMetodeBayar,
  { gateway, sekarang = new Date() }: { gateway: GatewayPembayaran; sekarang?: Date },
): Promise<InstruksiBayar> {
  if (!tokenValid(token)) throw new GalatAksi("Tagihan tidak ditemukan.", 404);
  const { masaBerlakuMenit } = cariMetode(metode)!;

  return db.transaction(async (tx) => {
    const [inv] = await tx
      .select({ id: invoices.id, organizationId: invoices.organizationId, nominal: invoices.nominal, status: invoices.status })
      .from(invoices)
      .where(eq(invoices.tokenPublik, token))
      .for("update");
    if (!inv) throw new GalatAksi("Tagihan tidak ditemukan.", 404);

    // Sama dengan dasar pencocokan nominal: uang diterima + yang sedang diperiksa pemilik kos.
    const [{ diterima }] = await tx
      .select({ diterima: sql<number>`coalesce(sum(${payments.nominalDibayar}), 0)`.mapWith(Number) })
      .from(payments)
      .where(and(eq(payments.invoiceId, inv.id), inArray(payments.status, ["valid", "tidak_cocok"])));
    const sisa = sisaTagihan(inv.nominal, diterima);
    if (!tagihanBisaDibayar(inv.status, sisa)) {
      throw new GalatAksi(
        inv.status === "draft"
          ? "Tagihan ini masih draf dan belum bisa dibayar."
          : "Tagihan ini sudah dibayar — tidak ada yang perlu dibayar lagi.",
        409,
      );
    }

    const [aktif] = await tx
      .select()
      .from(paymentAttempts)
      .where(
        and(
          eq(paymentAttempts.invoiceId, inv.id),
          eq(paymentAttempts.metode, metode),
          eq(paymentAttempts.nominal, sisa),
          eq(paymentAttempts.status, "menunggu"),
          gt(paymentAttempts.kedaluwarsaPada, new Date(sekarang.getTime() + SISA_BERLAKU_MINIMUM_MS)),
        ),
      )
      .orderBy(desc(paymentAttempts.percobaan))
      .limit(1);
    if (aktif) return keInstruksi(aktif);

    const [{ terakhir }] = await tx
      .select({ terakhir: max(paymentAttempts.percobaan) })
      .from(paymentAttempts)
      .where(eq(paymentAttempts.invoiceId, inv.id));
    const percobaan = (terakhir ?? 0) + 1;
    const orderId = `${inv.id}~${percobaan}`;

    let hasil;
    try {
      hasil = await gateway.buatTransaksi({ orderId, nominal: sisa, metode, masaBerlakuMenit });
    } catch (err) {
      console.error(`[pembayaran] transaksi ${orderId} gagal dibuat:`, err);
      throw new GalatAksi(GALAT_GATEWAY, 502);
    }

    const [baru] = await tx
      .insert(paymentAttempts)
      .values({
        organizationId: inv.organizationId,
        invoiceId: inv.id,
        percobaan,
        orderId,
        metode,
        nominal: sisa,
        nomorVa: hasil.nomorVa ?? null,
        kodePerusahaan: hasil.kodePerusahaan ?? null,
        qrString: hasil.qrString ?? null,
        referensiProvider: hasil.referensi,
        kedaluwarsaPada: hasil.kedaluwarsaPada,
      })
      .returning();
    return keInstruksi(baru);
  });
}
