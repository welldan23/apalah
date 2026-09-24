// Tool aksi Kosta: menyiapkan draft yang MENUNGGU KONFIRMASI owner — belum ada data yang diubah
// atau pesan yang dikirim sampai owner menyetujui preview (lihat putuskanDraft).

import { formatPeriode, formatRupiah, periodeBerikutnya } from "../format.ts";
import { siapkanDraftTagihan } from "./draft.ts";
import type { BalasanKosta } from "./tool-baca.ts";
import type { Db } from "../../db/index.ts";

type Pemilik = { organizationId: string; userId: string; conversationId?: string | null };

/**
 * Draft tagihan sewa. Tanpa periode: bulan berjalan selama masih ada penghuni yang belum ditagih,
 * selain itu bulan depan.
 */
export async function toolDraftTagihan(
  db: Db,
  pemilik: Pemilik,
  { periode, hariIni }: { periode?: string; hariIni: string },
): Promise<BalasanKosta> {
  const berjalan = hariIni.slice(0, 7);
  const preview =
    (await siapkanDraftTagihan(db, pemilik, periode ?? berjalan)) ??
    (periode ? null : await siapkanDraftTagihan(db, pemilik, periodeBerikutnya(berjalan)));

  if (!preview) {
    const cakupan = periode ? formatPeriode(periode) : `${formatPeriode(berjalan)} dan ${formatPeriode(periodeBerikutnya(berjalan))}`;
    return { teks: `Semua penghuni aktif sudah punya tagihan ${cakupan}. Tidak ada draft yang perlu dibuat.` };
  }
  return {
    teks: `Ini draft tagihan ${formatPeriode(preview.periode)} untuk ${preview.penerima.length} penghuni, total ${formatRupiah(preview.total)}. Belum ada tagihan yang dibuat sampai kamu konfirmasi.`,
    lampiran: { jenis: "preview_aksi", ...preview },
  };
}
