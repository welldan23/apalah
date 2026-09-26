// Pemrosesan notifikasi payment gateway — SATU-SATUNYA jalur yang boleh membuat invoice Lunas.
// Idempoten: setiap event dicatat di webhook_events; event yang sama tidak diproses dua kali.
// Nominal dicocokkan lewat cocokkanNominal (total uang diterima vs tagihan): cocok → Lunas;
// kurang/lebih/bayar ganda → Perlu review. Status transaksi dari halaman bayar (payment_attempts)
// ikut diperbarui: berhasil, kedaluwarsa, atau gagal.

import { and, eq, inArray, ne, sql } from "drizzle-orm";

import { schema, type Db } from "../../db/index.ts";
import type { NotifikasiPembayaran } from "./gateway.ts";
import { cocokkanNominal, ringkasKeputusan } from "./pencocokan.ts";

const { invoices, paymentAttempts, payments, webhookEvents } = schema;

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

    // Transaksi yang dibuat lewat halaman bayar, bila order ini berasal dari sana.
    const [transaksi] = await tx
      .select({ id: paymentAttempts.id, status: paymentAttempts.status, referensi: paymentAttempts.referensiProvider })
      .from(paymentAttempts)
      .where(eq(paymentAttempts.orderId, n.orderId));
    // Order yang dibuat Kostera hanya punya satu transaksi di gateway.
    if (transaksi?.referensi && transaksi.referensi !== n.referensi) {
      return selesai("diabaikan: referensi transaksi bukan milik order ini", { invoiceId: inv.id });
    }
    const tandaiTransaksi = async (status: "berhasil" | "kedaluwarsa" | "gagal") => {
      // Yang sudah berhasil tidak ditimpa notifikasi yang datang terlambat.
      if (transaksi && transaksi.status !== "berhasil") {
        await tx.update(paymentAttempts).set({ status }).where(eq(paymentAttempts.id, transaksi.id));
      }
    };

    const [lama] = await tx
      .select({ id: payments.id, status: payments.status })
      .from(payments)
      .where(and(eq(payments.provider, n.provider), eq(payments.referensiProvider, n.referensi)));

    if (n.status === "gagal" || n.status === "kedaluwarsa") {
      await tandaiTransaksi(n.status);
      if (lama?.status === "pending") await tx.delete(payments).where(eq(payments.id, lama.id));
      return selesai(`gagal: ${n.statusGateway}`, { invoiceId: inv.id, statusInvoice: inv.status });
    }

    if (n.status === "pending") {
      // QRIS/VA dari halaman bayar berstatus pending sejak dibuat: artinya MENUNGGU dibayar,
      // belum ada uang masuk — jangan dicatat sebagai pembayaran yang sedang diproses.
      if (transaksi) return selesai("menunggu pembayaran", { invoiceId: inv.id, statusInvoice: inv.status });
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

    // Berhasil: bandingkan total uang diterima (termasuk pembayaran sebelumnya) dengan tagihan.
    await tandaiTransaksi("berhasil");
    if (lama && lama.status !== "pending") return selesai("diabaikan: transaksi sudah tercatat", { invoiceId: inv.id });
    const [{ diterima }] = await tx
      .select({ diterima: sql<number>`coalesce(sum(${payments.nominalDibayar}), 0)`.mapWith(Number) })
      .from(payments)
      .where(
        and(
          eq(payments.invoiceId, inv.id),
          inArray(payments.status, ["valid", "tidak_cocok"]),
          ne(payments.referensiProvider, n.referensi),
        ),
      );
    const keputusan = cocokkanNominal({ nominalTagihan: inv.nominal, sudahDiterima: diterima, nominalBayar: n.nominal });
    const cocok = keputusan.alasan === "cocok";
    const dataBayar = {
      nominalDibayar: n.nominal,
      metode: n.metode,
      status: keputusan.statusPembayaran,
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

    if (cocok) {
      // Total sudah pas: pembayaran sebagian sebelumnya ikut dianggap sah.
      await tx
        .update(payments)
        .set({ status: "valid" })
        .where(and(eq(payments.invoiceId, inv.id), eq(payments.status, "tidak_cocok")));
    }
    await tx
      .update(invoices)
      .set(cocok ? { status: "lunas", dibayarPada: n.waktu } : { status: "perlu_review" })
      .where(eq(invoices.id, inv.id));
    return selesai(ringkasKeputusan(keputusan), { invoiceId: inv.id, statusInvoice: keputusan.statusInvoice });
  });
}
