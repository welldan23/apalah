// Keputusan atas preview aksi Kosta di luar chat, beserta audit:
// - owner/admin menekan Setuju/Batal di dashboard (POST /api/kosta/draft/[id]);
// - cron harian membatalkan preview yang lewat masa berlaku.

import type { Db } from "../../db/index.ts";
import { GalatAksi } from "../aksi/galat.ts";
import type { PengirimWhatsApp } from "../whatsapp/index.ts";
import { catatAuditKosta } from "./audit.ts";
import { kedaluwarsakanDraft, putuskanDraft, type HasilKeputusan } from "./draft.ts";

/** Setuju/batal dari dashboard; berhasil maupun ditolak (sudah diputuskan, kos lain) tercatat di audit. */
export async function putuskanDraftDariDashboard(
  db: Db,
  { draftId, organizationId, userId, keputusan }: { draftId: string; organizationId: string; userId: string; keputusan: "setuju" | "batal" },
  deps: { wa: PengirimWhatsApp; baseUrl: string; sekarang?: Date },
): Promise<HasilKeputusan> {
  const dasar = {
    saluran: "dashboard" as const,
    statusPengirim: "siap" as const,
    organizationId,
    actorUserId: userId,
    intent: "confirm_action",
    tool: "putuskanDraft",
    actionId: draftId,
    payload: { setuju: keputusan === "setuju" },
  };
  try {
    const hasil = await putuskanDraft(db, { draftId, organizationId, keputusan }, deps);
    await catatAuditKosta(db, {
      ...dasar,
      statusKonfirmasi: hasil.kedaluwarsa ? "kedaluwarsa" : hasil.status,
      hasil: hasil.status === "dijalankan" ? "dijalankan" : "dibatalkan",
    });
    return hasil;
  } catch (err) {
    await catatAuditKosta(db, { ...dasar, hasil: err instanceof GalatAksi ? "ditolak" : "galat" });
    throw err;
  }
}

/** Cron: batalkan preview yang menunggu lebih dari 24 jam dan catat tiap pembatalan. */
export async function kedaluwarsakanDraftDanCatat(db: Db, sekarang = new Date()) {
  const kedaluwarsa = await kedaluwarsakanDraft(db, sekarang);
  for (const d of kedaluwarsa) {
    await catatAuditKosta(db, {
      saluran: "sistem",
      statusPengirim: "siap",
      organizationId: d.organizationId,
      actorUserId: d.userId,
      intent: "expire_action",
      tool: "kedaluwarsakanDraft",
      actionId: d.id,
      statusKonfirmasi: "kedaluwarsa",
      hasil: "dibatalkan",
    });
  }
  return kedaluwarsa.length;
}
