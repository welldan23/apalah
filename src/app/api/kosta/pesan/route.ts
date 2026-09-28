// POST /api/kosta/pesan — owner/admin chat dengan Kosta dari web. Body: { teks }.
// Percakapannya sama dengan di WhatsApp (per nomor WA pengguna); balasan tidak dikirim ke WA.

import { getDb } from "@/db";
import { bacaJson, GalatAksi, pastikanPengelola, responGalat } from "@/lib/aksi/galat";
import { getWorkspaceSessionApi } from "@/lib/data/session";
import { getDepsKosta } from "@/lib/kosta/deps";
import { prosesPesanKosta } from "@/lib/kosta/proses-pesan";
import { catatPesan, pastikanPercakapan } from "@/lib/kosta/riwayat";

export async function POST(request: Request) {
  try {
    const session = await getWorkspaceSessionApi();
    pastikanPengelola(session.peran);
    const { teks } = await bacaJson(request);
    const isi = typeof teks === "string" ? teks.trim() : "";
    if (!isi || isi.length > 1000) throw new GalatAksi("Pesan harus berisi 1–1000 karakter.");

    const db = await getDb();
    const percakapan = await pastikanPercakapan(db, session.user.nomorWa);
    const masuk = await catatPesan(db, {
      conversationId: percakapan.id,
      organizationId: percakapan.organizationId,
      arah: "masuk",
      isi,
    });
    const balasan = await prosesPesanKosta(
      db,
      { conversationId: percakapan.id, messageId: masuk.id, teks: isi, saluran: "web" },
      getDepsKosta(request),
    );
    return Response.json({ pesan: [masuk, balasan] });
  } catch (err) {
    return responGalat(err);
  }
}
