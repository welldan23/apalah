// Status pilot Kosta per kos (tabel kosta_pilot; tanpa baris = aktif). Saat disuspend platform admin,
// Kosta tidak memproses chat untuk kos itu — data kos dan dashboard owner tidak tersentuh.

import { eq } from "drizzle-orm";

import { schema, type Db } from "../../db/index.ts";

export async function statusPilotKosta(db: Db, organizationId: string) {
  const [baris] = await db
    .select({ aktif: schema.kostaPilot.aktif, alasan: schema.kostaPilot.alasan, diubahPada: schema.kostaPilot.diubahPada })
    .from(schema.kostaPilot)
    .where(eq(schema.kostaPilot.organizationId, organizationId));
  return baris ?? { aktif: true, alasan: null, diubahPada: null };
}

export const PILOT_DISUSPEND =
  "Kosta sedang dinonaktifkan sementara untuk kos ini oleh tim Kostera. Kamu tetap bisa memakai dashboard Kostera seperti biasa.";
