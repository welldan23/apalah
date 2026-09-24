// Pemrosesan notifikasi payment gateway — SATU-SATUNYA jalur yang boleh membuat invoice Lunas.
// Idempoten: setiap event dicatat di webhook_events; event yang sama tidak diproses dua kali.
// Nominal dicocokkan secara deterministik: cocok → Lunas; tidak cocok / bayar ganda → Perlu review.

import { and, eq } from "drizzle-orm";

import { schema, type Db } from "../../db/index.ts";
import type { NotifikasiPembayaran } from "./midtrans.ts";

const { invoices, payments, webhookEvents } = schema;

export type HasilNotifikasi =
  | { duplikat: true }
  | { duplikat: false; hasil: string; invoiceId?: string; statusInvoice?: string };

export async function prosesNotifikasiPembayaran(db: Db, n: NotifikasiPembayaran): Promise<HasilNotifikasi> {
  return db.transaction(async (tx) => {
    const [event] = await tx
      .insert(webhookEvents)
      .values({ provider: n.provider, eventId: n.eventId, payload: n.payload })
      .onConflictDoNothing({ target: [webhookEvents.provider, webhookEvents.eventId] })
      .returning({ id: webhookEvents.id });
    if (!event) return { duplikat: true as const };

    const selesai = async (hasil: string, extra: { invoiceId?: string; statusInvoice?: string } = {}) => {
      await tx.update(webhookEvents).set({ diprosesPada: new Date(), hasil }).where(eq(webhookEvents.id, event.id));
      return { duplikat: false as const, hasil, ...extra };
    };

    if (n.status === "abaikan") return selesai(`diabaikan: status ${n.statusGateway}`);

    // Kunci baris invoice supaya dua notifikasi bersamaan tidak saling menimpa.
    const [inv] = await tx
      .select({ id: invoices.id, nominal: invoices.nominal, status: invoices.status })
      .from(invoices)
      .where(eq(invoices.id, n.invoiceId))
      .for("update");
    if (!inv) return selesai("diabaikan: invoice tidak ditemukan");

    const [lama] = await tx
      .select({ id: payments.id, status: payments.status })
      .from(payments)
      .where(and(eq(payments.provider, n.provider), eq(payments.referensiProvider, n.referensi)));

    if (n.status === "gagal") {
      if (lama?.status === "pending") await tx.delete(payments).where(eq(payments.id, lama.id));
      return selesai(`gagal: ${n.statusGateway}`, { invoiceId: inv.id, statusInvoice: inv.status });
    }

    if (n.status === "pending") {
      if (!lama) {
        await tx.insert(payments).values({
          invoiceId: inv.id,
          nominalDibayar: n.nominal,
          metode: n.metode,
          provider: n.provider,
          referensiProvider: n.referensi,
          status: "pending",
          webhookEventId: event.id,
        });
      }
      return selesai("pending", { invoiceId: inv.id, statusInvoice: inv.status });
    }

    // Berhasil: bandingkan nominal; invoice yang sudah lunas berarti pembayaran ganda.
    if (lama && lama.status !== "pending") return selesai("diabaikan: transaksi sudah tercatat", { invoiceId: inv.id });
    const cocok = n.nominal === inv.nominal && inv.status !== "lunas";
    const dataBayar = {
      nominalDibayar: n.nominal,
      metode: n.metode,
      status: cocok ? ("valid" as const) : ("tidak_cocok" as const),
      diverifikasiPada: n.waktu,
      webhookEventId: event.id,
    };
    if (lama) {
      await tx.update(payments).set(dataBayar).where(eq(payments.id, lama.id));
    } else {
      await tx.insert(payments).values({
        ...dataBayar,
        invoiceId: inv.id,
        provider: n.provider,
        referensiProvider: n.referensi,
      });
    }

    const statusInvoice = cocok ? "lunas" : "perlu_review";
    await tx
      .update(invoices)
      .set(cocok ? { status: "lunas", dibayarPada: n.waktu } : { status: "perlu_review" })
      .where(eq(invoices.id, inv.id));
    const hasil = cocok ? "lunas" : inv.status === "lunas" ? "perlu_review: pembayaran ganda" : "perlu_review: nominal tidak cocok";
    return selesai(hasil, { invoiceId: inv.id, statusInvoice });
  });
}
