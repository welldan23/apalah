// Aksi cepat "Buat tagihan": tagihan sewa untuk kamar terpilih dalam satu periode.
// Nominal ditentukan server (harga sewa penghuni atau nominal khusus), bukan dari klien.
// Kamar yang sudah punya tagihan di periode itu dilewati, jadi aman bila terkirim dua kali.

import { randomBytes } from "node:crypto";

import { and, eq, inArray } from "drizzle-orm";

import { schema, type Db } from "../../db/index.ts";
import { periodeValid } from "../waktu.ts";
import { GalatAksi, nominalValid, tanggalValid } from "./galat.ts";

const { invoices, rooms, tenants } = schema;

export type InputBuatTagihan = {
  periode: string;
  jatuhTempo: string;
  roomIds: string[];
  /** Kosong = sesuai harga sewa masing-masing penghuni. */
  nominalKhusus?: number;
};

export type HasilBuatTagihan = {
  dibuat: number;
  totalNominal: number;
  /** Nomor kamar yang dilewati karena sudah punya tagihan di periode itu. */
  dilewati: string[];
};

export function bacaInputBuatTagihan(body: Record<string, unknown>): InputBuatTagihan {
  const { periode, jatuhTempo, roomIds, nominalKhusus } = body;
  if (typeof periode !== "string" || !periodeValid(periode)) {
    throw new GalatAksi("Periode harus berformat YYYY-MM.");
  }
  if (!tanggalValid(jatuhTempo)) throw new GalatAksi("Tanggal jatuh tempo tidak valid.");
  if (
    !Array.isArray(roomIds) ||
    roomIds.length === 0 ||
    roomIds.length > 500 ||
    !roomIds.every((id) => typeof id === "string")
  ) {
    throw new GalatAksi("Pilih minimal satu kamar.");
  }
  if (nominalKhusus != null && !nominalValid(nominalKhusus)) {
    throw new GalatAksi("Nominal tagihan harus bilangan bulat rupiah lebih dari 0.");
  }
  return {
    periode,
    jatuhTempo,
    roomIds: [...new Set(roomIds as string[])],
    nominalKhusus: nominalKhusus ?? undefined,
  };
}

/** Token acak untuk link invoice publik — tidak bisa ditebak. */
export function buatTokenPublik() {
  return randomBytes(18).toString("base64url");
}

export async function buatTagihan(
  db: Db,
  organizationId: string,
  input: InputBuatTagihan,
): Promise<HasilBuatTagihan> {
  const penghuni = await db
    .select({
      tenantId: tenants.id,
      roomId: rooms.id,
      nomorKamar: rooms.nomorKamar,
      hargaSewa: tenants.hargaSewa,
    })
    .from(rooms)
    .innerJoin(
      tenants,
      and(
        eq(tenants.roomId, rooms.id),
        eq(tenants.status, "aktif"),
        eq(tenants.organizationId, organizationId),
      ),
    )
    .where(and(eq(rooms.organizationId, organizationId), inArray(rooms.id, input.roomIds)));

  if (penghuni.length !== input.roomIds.length) {
    const jumlahHilang = input.roomIds.length - penghuni.length;
    throw new GalatAksi(`${jumlahHilang} kamar tidak ditemukan atau belum berpenghuni.`, 404);
  }

  const dibuat = await db
    .insert(invoices)
    .values(
      penghuni.map((p) => ({
        organizationId,
        tenantId: p.tenantId,
        roomId: p.roomId,
        periode: input.periode,
        nominal: input.nominalKhusus ?? p.hargaSewa,
        jatuhTempo: input.jatuhTempo,
        status: "menunggu" as const,
        tokenPublik: buatTokenPublik(),
      })),
    )
    .onConflictDoNothing({ target: [invoices.tenantId, invoices.periode] })
    .returning({ roomId: invoices.roomId, nominal: invoices.nominal });

  const baru = new Set(dibuat.map((inv) => inv.roomId));
  return {
    dibuat: dibuat.length,
    totalNominal: dibuat.reduce((total, inv) => total + inv.nominal, 0),
    dilewati: penghuni
      .filter((p) => !baru.has(p.roomId))
      .map((p) => p.nomorKamar)
      .sort(),
  };
}
