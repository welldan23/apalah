// POST /api/dashboard/kamar — tambah kamar massal dari rencana (wizard Tambah kos & kamar).
// Body: { rencana: [{ tipe, kode, jumlah, hargaSewa }], kosBaru?: { namaKos, alamat } }.
// Nomor kamar dibuat server, melanjutkan nomor yang sudah ada tanpa bentrok.

import { getDb } from "@/db";
import { tambahKamar, bacaInputTambahKamar } from "@/lib/aksi/kamar";
import { bacaJson, GalatAksi, pastikanPengelola, responGalat } from "@/lib/aksi/galat";
import { getWorkspaceSessionApi } from "@/lib/data/session";

export async function POST(request: Request) {
  try {
    const session = await getWorkspaceSessionApi();
    pastikanPengelola(session.peran);
    const input = bacaInputTambahKamar(await bacaJson(request));
    // Kos baru hanya bisa dibuat pemilik; admin menambah kamar di kos yang ia kelola.
    if (input.kosBaru && session.peran !== "owner") throw new GalatAksi("Hanya pemilik yang bisa membuat kos baru.", 403);
    const hasil = await tambahKamar(
      await getDb(),
      { organizationId: session.organization.id, userId: session.user.id },
      input,
    );
    return Response.json(hasil, { status: 201 });
  } catch (err) {
    return responGalat(err);
  }
}
