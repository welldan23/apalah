// Riwayat percakapan owner dengan Kosta dari wa_messages, dalam bentuk PesanKosta untuk halaman Kosta.
// Status kartu preview selalu mengikuti status draft terbaru di action_drafts.

import { asc, eq, inArray } from "drizzle-orm";

import { schema, type Db } from "../../db/index.ts";
import type { LampiranKosta, PesanKosta } from "@/lib/types";

const { actionDrafts, waConversations, waMessages } = schema;

type BarisPesan = Pick<typeof waMessages.$inferSelect, "id" | "arah" | "isi" | "lampiran" | "dibuatPada">;

const kePesanKosta = (m: BarisPesan): PesanKosta => ({
  id: m.id,
  dari: m.arah === "masuk" ? "owner" : "kosta",
  waktu: m.dibuatPada.toISOString(),
  teks: m.isi,
  ...(m.lampiran ? { lampiran: m.lampiran } : {}),
});

/** Percakapan milik nomor WA pengguna; kosong bila belum pernah chat. */
export async function getPercakapanPengguna(db: Db, nomorWa: string) {
  const [percakapan] = await db
    .select({ id: waConversations.id })
    .from(waConversations)
    .where(eq(waConversations.nomorWa, nomorWa));
  if (!percakapan) return { conversationId: null, pesan: [] as PesanKosta[] };

  const baris = await db
    .select()
    .from(waMessages)
    .where(eq(waMessages.conversationId, percakapan.id))
    .orderBy(asc(waMessages.dibuatPada), asc(waMessages.id));

  const draftIds = baris.flatMap((m) =>
    m.lampiran?.jenis === "preview_aksi" && m.lampiran.draftId ? [m.lampiran.draftId] : [],
  );
  const statusDraft = new Map(
    draftIds.length
      ? (
          await db
            .select({ id: actionDrafts.id, status: actionDrafts.status })
            .from(actionDrafts)
            .where(inArray(actionDrafts.id, draftIds))
        ).map((d) => [d.id, d.status])
      : [],
  );

  const pesan = baris.map((m) => {
    const p = kePesanKosta(m);
    const status = p.lampiran?.jenis === "preview_aksi" && p.lampiran.draftId ? statusDraft.get(p.lampiran.draftId) : undefined;
    return status && p.lampiran?.jenis === "preview_aksi" ? { ...p, lampiran: { ...p.lampiran, status } } : p;
  });
  return { conversationId: percakapan.id, pesan };
}

/** Catat satu pesan di percakapan (mis. keputusan owner dari web & balasan Kosta). */
export async function catatPesan(
  db: Db,
  {
    conversationId,
    organizationId,
    arah,
    isi,
    lampiran,
  }: { conversationId: string; organizationId: string | null; arah: "masuk" | "keluar"; isi: string; lampiran?: LampiranKosta },
): Promise<PesanKosta> {
  const sekarang = new Date();
  const [baris] = await db
    .insert(waMessages)
    .values({ conversationId, organizationId, arah, isi, lampiran: lampiran ?? null, dibuatPada: sekarang })
    .returning();
  await db.update(waConversations).set({ terakhirPesanPada: sekarang }).where(eq(waConversations.id, conversationId));
  return kePesanKosta(baris);
}
