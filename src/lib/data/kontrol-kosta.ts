// Kontrol Kosta untuk dashboard owner/admin (hanya kos yang sedang dibuka): nomor WA tertaut, status
// pilot, mode kanal WhatsApp, aksi Kosta yang menunggu persetujuan, dan riwayat aksi relevan.
// Data ringkasan preview dipilih seperlunya — tanpa ID penyewa/tagihan internal.

import { and, desc, eq, gte, inArray } from "drizzle-orm";

import { schema, type Db } from "../../db/index.ts";
import { MASA_BERLAKU_DRAFT_MS } from "../kosta/draft.ts";
import { statusPilotKosta } from "../kosta/pilot.ts";
import { modeWhatsApp } from "../whatsapp/index.ts";
import type { PreviewAksi } from "@/lib/types";

const { actionDrafts, kostaAuditLogs, users } = schema;

/** Intent kanonik yang ditampilkan di riwayat aksi owner, dengan labelnya. */
const LABEL_RIWAYAT: Record<string, string> = {
  prepare_invoice_generation: "Siapkan tagihan",
  prepare_reminder: "Siapkan reminder",
  prepare_tenant_move: "Pindah/keluar penghuni",
  revise_action: "Koreksi draft",
  confirm_action: "Keputusan aksi",
  expire_action: "Aksi kedaluwarsa",
  mark_invoice_paid: "Minta tandai lunas",
};

const LABEL_HASIL: Record<string, string> = {
  menunggu_konfirmasi: "menunggu konfirmasi",
  dijalankan: "dijalankan",
  dibatalkan: "dibatalkan",
  ditolak: "ditolak",
  klarifikasi: "perlu klarifikasi",
  dijawab: "dijawab",
  galat: "gagal",
};

export async function getKontrolKosta(
  db: Db,
  { organizationId, userId, sekarang = new Date(), env = process.env }: { organizationId: string; userId: string; sekarang?: Date; env?: Partial<Record<string, string>> },
) {
  const [pengguna] = await db
    .select({ nomorWa: users.nomorWa, terverifikasi: users.nomorWaTerverifikasi })
    .from(users)
    .where(eq(users.id, userId));
  const pilot = await statusPilotKosta(db, organizationId);

  const draf = await db
    .select({ id: actionDrafts.id, status: actionDrafts.status, data: actionDrafts.ringkasanPreview })
    .from(actionDrafts)
    .where(
      and(
        eq(actionDrafts.organizationId, organizationId),
        eq(actionDrafts.status, "menunggu_konfirmasi"),
        gte(actionDrafts.dibuatPada, new Date(sekarang.getTime() - MASA_BERLAKU_DRAFT_MS)),
      ),
    )
    .orderBy(desc(actionDrafts.dibuatPada))
    .limit(5);
  const aksiMenunggu: PreviewAksi[] = draf.map(({ id, status, data }) => ({
    aksi: data.aksi,
    periode: data.periode,
    penerima: data.penerima,
    total: data.total,
    status,
    draftId: id,
    ...(data.keterangan ? { keterangan: data.keterangan } : {}),
  }));

  const riwayat = await db
    .select({
      waktu: kostaAuditLogs.dibuatPada,
      intent: kostaAuditLogs.intent,
      hasil: kostaAuditLogs.hasil,
      saluran: kostaAuditLogs.saluran,
    })
    .from(kostaAuditLogs)
    .where(and(eq(kostaAuditLogs.organizationId, organizationId), inArray(kostaAuditLogs.intent, Object.keys(LABEL_RIWAYAT))))
    .orderBy(desc(kostaAuditLogs.dibuatPada))
    .limit(8);

  return {
    nomorWa: pengguna?.nomorWa ?? null,
    nomorTerverifikasi: pengguna?.terverifikasi ?? false,
    pilot: { aktif: pilot.aktif, alasan: pilot.alasan },
    kanal: modeWhatsApp(env),
    aksiMenunggu,
    riwayat: riwayat.map((r) => ({
      waktu: r.waktu.toISOString(),
      label: LABEL_RIWAYAT[r.intent ?? ""] ?? r.intent ?? "-",
      hasil: LABEL_HASIL[r.hasil] ?? r.hasil,
      saluran: r.saluran,
    })),
  };
}

export type KontrolKosta = Awaited<ReturnType<typeof getKontrolKosta>>;
