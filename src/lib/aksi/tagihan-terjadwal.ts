// Pengaturan tagihan terjadwal bulanan per kos (tabel invoice_schedules): baca, validasi, simpan.
// Kos yang belum pernah menyimpan memakai PENGATURAN_BAWAAN (nonaktif).

import { eq } from "drizzle-orm";

import { schema, type Db } from "../../db/index.ts";
import {
  PENGATURAN_BAWAAN,
  type AturanJatuhTempo,
  type PengaturanTagihanTerjadwal,
} from "../tagihan-terjadwal.ts";
import { GalatAksi } from "./galat.ts";

const { invoiceSchedules } = schema;

const tanggalBulanan = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 28;

/** Aturan jatuh tempo dari satu baris invoice_schedules. */
export function aturanJatuhTempoDari(
  baris: Pick<typeof invoiceSchedules.$inferSelect, "aturanJatuhTempo" | "tanggalJatuhTempo">,
): AturanJatuhTempo {
  return baris.aturanJatuhTempo === "tanggal_tetap" && baris.tanggalJatuhTempo
    ? { aturan: "tanggal_tetap", tanggal: baris.tanggalJatuhTempo }
    : { aturan: "tanggal_masuk" };
}

export async function getPengaturanTagihanTerjadwal(
  db: Db,
  organizationId: string,
): Promise<PengaturanTagihanTerjadwal> {
  const [baris] = await db
    .select()
    .from(invoiceSchedules)
    .where(eq(invoiceSchedules.organizationId, organizationId));
  if (!baris) return PENGATURAN_BAWAAN;
  return {
    aktif: baris.aktif,
    tanggalTerbit: baris.tanggalTerbit,
    jatuhTempo: aturanJatuhTempoDari(baris),
  };
}

export function bacaInputPengaturan(body: Record<string, unknown>): PengaturanTagihanTerjadwal {
  const { aktif, tanggalTerbit, jatuhTempo } = body;
  if (typeof aktif !== "boolean") throw new GalatAksi("Status aktif harus true atau false.");
  if (!tanggalBulanan(tanggalTerbit)) throw new GalatAksi("Tanggal terbit harus 1–28.");

  const aturan = (jatuhTempo as { aturan?: unknown } | null)?.aturan;
  if (aturan === "tanggal_masuk") return { aktif, tanggalTerbit, jatuhTempo: { aturan } };
  if (aturan === "tanggal_tetap") {
    const tanggal = (jatuhTempo as { tanggal?: unknown }).tanggal;
    if (!tanggalBulanan(tanggal)) throw new GalatAksi("Tanggal jatuh tempo harus 1–28.");
    return { aktif, tanggalTerbit, jatuhTempo: { aturan, tanggal } };
  }
  throw new GalatAksi("Aturan jatuh tempo harus tanggal_masuk atau tanggal_tetap.");
}

/** Simpan (buat atau timpa) pengaturan satu kos. */
export async function simpanPengaturanTagihanTerjadwal(
  db: Db,
  organizationId: string,
  p: PengaturanTagihanTerjadwal,
): Promise<PengaturanTagihanTerjadwal> {
  const nilai = {
    aktif: p.aktif,
    tanggalTerbit: p.tanggalTerbit,
    aturanJatuhTempo: p.jatuhTempo.aturan,
    tanggalJatuhTempo: p.jatuhTempo.aturan === "tanggal_tetap" ? p.jatuhTempo.tanggal : null,
    diperbaruiPada: new Date(),
  };
  await db
    .insert(invoiceSchedules)
    .values({ organizationId, ...nilai })
    .onConflictDoUpdate({ target: invoiceSchedules.organizationId, set: nilai });
  return getPengaturanTagihanTerjadwal(db, organizationId);
}
