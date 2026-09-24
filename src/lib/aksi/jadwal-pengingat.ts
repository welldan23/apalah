// Jadwal pengingat bayar otomatis per kos (tabel reminder_schedules).

import { schema, type Db } from "../../db/index.ts";
import { JADWAL_BAWAAN } from "../reminder.ts";

/** Kos baru langsung punya jadwal bawaan H-3 / H / H+3 jam 09.00 WIB. */
export async function sisipkanJadwalBawaan(db: Pick<Db, "insert">, organizationId: string) {
  await db.insert(schema.reminderSchedules).values(
    JADWAL_BAWAAN.map((j) => ({ organizationId, offsetHari: j.offsetHari, jamKirim: j.jam, aktif: j.aktif })),
  );
}
