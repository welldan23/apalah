// Penjadwal tagihan terjadwal — dijalankan harian oleh cron (GET /api/cron/harian).
// Untuk tiap kos yang mengaktifkan tagihan terjadwal, tagihan periode bulan berjalan diterbitkan
// begitu tanggal terbitnya tiba. Aman dijalankan berulang: penghuni yang sudah punya tagihan di
// periode itu dilewati, dan hari yang terlewat (cron mati) disusul pada jalan berikutnya.

import { and, eq, lt } from "drizzle-orm";

import { schema, type Db } from "../../db/index.ts";
import { sisipkanTagihan } from "../aksi/tagihan.ts";
import { aturanJatuhTempoDari } from "../aksi/tagihan-terjadwal.ts";
import { periodeBerikutnya } from "../format.ts";
import { jatuhTempoUntuk } from "../tagihan-terjadwal.ts";
import { tanggalWib } from "../waktu.ts";

const { invoiceSchedules, tenants } = schema;

export type HasilTerbitKos = {
  organizationId: string;
  periode: string;
  dibuat: number;
  totalNominal: number;
  galat?: string;
};

/** Terbitkan tagihan terjadwal yang jatuh pada `hariIni` (YYYY-MM-DD, WIB). */
export async function terbitkanTagihanTerjadwal(db: Db, hariIni: string): Promise<HasilTerbitKos[]> {
  const periode = hariIni.slice(0, 7);
  const jadwal = await db.select().from(invoiceSchedules).where(eq(invoiceSchedules.aktif, true));

  const hasil: HasilTerbitKos[] = [];
  for (const j of jadwal) {
    const tanggalTerbit = `${periode}-${String(j.tanggalTerbit).padStart(2, "0")}`;
    // Belum waktunya — atau jadwal baru diaktifkan/diubah setelah tanggal terbit bulan ini, jadi
    // penerbitan pertamanya bulan depan (sama dengan "Penerbitan berikutnya" di halaman pengaturan).
    if (hariIni < tanggalTerbit || tanggalWib(j.diperbaruiPada) > tanggalTerbit) continue;

    try {
      const aturan = aturanJatuhTempoDari(j);
      const penghuni = await db
        .select({
          tenantId: tenants.id,
          roomId: tenants.roomId,
          tanggalMasuk: tenants.tanggalMasuk,
          hargaSewa: tenants.hargaSewa,
        })
        .from(tenants)
        .where(
          and(
            eq(tenants.organizationId, j.organizationId),
            eq(tenants.status, "aktif"),
            // Penghuni yang baru masuk setelah periode ini belum ditagih.
            lt(tenants.tanggalMasuk, `${periodeBerikutnya(periode)}-01`),
          ),
        );
      const dibuat = await sisipkanTagihan(
        db,
        j.organizationId,
        penghuni.map((p) => ({
          tenantId: p.tenantId,
          roomId: p.roomId,
          periode,
          jatuhTempo: jatuhTempoUntuk(aturan, periode, p.tanggalMasuk),
          sewa: p.hargaSewa,
        })),
      );
      hasil.push({
        organizationId: j.organizationId,
        periode,
        dibuat: dibuat.length,
        totalNominal: dibuat.reduce((total, inv) => total + inv.nominal, 0),
      });
    } catch (err) {
      // Satu kos gagal tidak menghentikan kos lain.
      console.error(`Tagihan terjadwal ${j.organizationId} gagal:`, err);
      hasil.push({ organizationId: j.organizationId, periode, dibuat: 0, totalNominal: 0, galat: "Gagal menerbitkan tagihan." });
    }
  }
  return hasil;
}
