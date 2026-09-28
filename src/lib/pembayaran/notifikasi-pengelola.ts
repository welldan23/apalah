// Kirim satu pesan ke semua owner/admin aktif sebuah kos yang nomor WhatsApp-nya terverifikasi, lalu
// catat di riwayat chat Kosta mereka. Owner belum tentu chat dalam 24 jam terakhir, jadi lewat Cloud
// API wajib memakai template resmi.

import { and, eq, inArray } from "drizzle-orm";

import { schema, type Db } from "../../db/index.ts";
import { catatPesan, pastikanPercakapan } from "../kosta/riwayat.ts";
import type { PengirimWhatsApp, TemplateWhatsApp } from "../whatsapp/index.ts";
import { kirimDanCatat, type JenisPesanWa } from "../whatsapp/log.ts";

const { members, users } = schema;

/** Jumlah pengelola yang berhasil dikirimi. */
export async function kirimKePengelola(
  db: Db,
  wa: PengirimWhatsApp,
  {
    organizationId,
    teks,
    template,
    jenis,
    referensiId,
  }: { organizationId: string; teks: string; template: TemplateWhatsApp; jenis: JenisPesanWa; referensiId: string },
) {
  const pengelola = await db
    .select({ nomorWa: users.nomorWa })
    .from(members)
    .innerJoin(users, eq(users.id, members.userId))
    .where(
      and(
        eq(members.organizationId, organizationId),
        eq(members.status, "aktif"),
        inArray(members.peran, ["owner", "admin"]),
        eq(users.nomorWaTerverifikasi, true),
      ),
    );

  let terkirim = 0;
  for (const { nomorWa } of pengelola) {
    const { ok } = await kirimDanCatat(db, wa, { ke: nomorWa, teks, template }, { jenis, organizationId, referensiId });
    if (ok) terkirim += 1;
    const percakapan = await pastikanPercakapan(db, nomorWa);
    await catatPesan(db, { conversationId: percakapan.id, organizationId, arah: "keluar", isi: teks });
  }
  return terkirim;
}
