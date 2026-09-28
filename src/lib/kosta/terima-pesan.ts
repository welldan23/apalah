// Simpan pesan WhatsApp masuk ke percakapan per nomor (wa_conversations + wa_messages).
// Idempoten: webhook yang dikirim ulang provider (ID pesan sama) tidak tercatat dua kali.
// Nomor yang belum tertaut tetap tercatat tanpa pengguna/kos — tidak membuka data kos apa pun.

import { sql } from "drizzle-orm";

import { schema, type Db } from "../../db/index.ts";
import type { PesanMasuk } from "../whatsapp/webhook.ts";

const { waConversations, waMessages } = schema;

export type PesanTersimpan = PesanMasuk & {
  conversationId: string;
  messageId: string;
  userId: string | null;
  organizationId: string | null;
};

/** Mengembalikan hanya pesan yang baru tersimpan (bukan kiriman ulang). */
export async function simpanPesanMasuk(db: Db, daftar: PesanMasuk[]): Promise<PesanTersimpan[]> {
  const baru: PesanTersimpan[] = [];
  for (const p of daftar) {
    const [percakapan] = await db
      .insert(waConversations)
      .values({ nomorWa: p.dari, terakhirPesanPada: p.waktu })
      .onConflictDoUpdate({
        target: waConversations.nomorWa,
        set: { terakhirPesanPada: sql`greatest(${waConversations.terakhirPesanPada}, excluded.terakhir_pesan_pada)` },
      })
      .returning({
        id: waConversations.id,
        userId: waConversations.userId,
        organizationId: waConversations.organizationId,
      });

    const [pesan] = await db
      .insert(waMessages)
      .values({
        conversationId: percakapan.id,
        organizationId: percakapan.organizationId,
        arah: "masuk",
        isi: p.teks,
        idPesanProvider: p.idProvider,
        dibuatPada: p.waktu,
      })
      .onConflictDoNothing({ target: waMessages.idPesanProvider })
      .returning({ id: waMessages.id });

    if (pesan) {
      baru.push({
        ...p,
        conversationId: percakapan.id,
        messageId: pesan.id,
        userId: percakapan.userId,
        organizationId: percakapan.organizationId,
      });
    }
  }
  return baru;
}
