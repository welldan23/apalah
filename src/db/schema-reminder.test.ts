import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { and, asc, eq } from "drizzle-orm";

import { tambahKamar } from "../lib/aksi/kamar.ts";
import { kirimKonfirmasiLunas } from "../lib/pembayaran/konfirmasi.ts";
import type { Db } from "./index.ts";
import * as schema from "./schema.ts";
import { isiDataContoh } from "./seed.ts";
import { buatDbUji } from "./testing.ts";

const ORG = "org_kos_melati";

describe("skema jadwal & log reminder", () => {
  let db: Db;
  let tutup: () => Promise<void>;

  const ditolakOleh = (query: Promise<unknown>, constraint: string) =>
    assert.rejects(query, (err: Error & { cause?: Error }) => {
      assert.match(err.cause?.message ?? err.message, new RegExp(constraint));
      return true;
    });
  const jadwal = (organizationId: string) =>
    db
      .select({ offsetHari: schema.reminderSchedules.offsetHari, jamKirim: schema.reminderSchedules.jamKirim, aktif: schema.reminderSchedules.aktif })
      .from(schema.reminderSchedules)
      .where(eq(schema.reminderSchedules.organizationId, organizationId))
      .orderBy(asc(schema.reminderSchedules.offsetHari));
  const BAWAAN = [
    { offsetHari: -3, jamKirim: "09:00:00", aktif: true },
    { offsetHari: 0, jamKirim: "09:00:00", aktif: true },
    { offsetHari: 3, jamKirim: "09:00:00", aktif: true },
  ];

  before(async () => {
    ({ db, tutup } = await buatDbUji());
    await isiDataContoh(db);
  });
  after(() => tutup());

  it("setiap kos contoh punya jadwal bawaan H-3/H/H+3 jam 09.00 dan pengingat otomatis menyala", async () => {
    for (const org of [ORG, "org_kos_mawar", "org_griya_asri"]) assert.deepEqual(await jadwal(org), BAWAAN, org);
    const [kos] = await db.select({ nyala: schema.organizations.pengingatOtomatis }).from(schema.organizations).where(eq(schema.organizations.id, ORG));
    assert.equal(kos.nyala, true);
  });

  it("kos baru dari Tambah kos & kamar langsung mendapat jadwal bawaan", async () => {
    const { organizationId } = await tambahKamar(
      db,
      { organizationId: ORG, userId: "usr_ratna" },
      { rencana: [{ tipe: "Standar", kode: "A", jumlah: 2, hargaSewa: 500_000 }], kosBaru: { namaKos: "Kos Baru", alamat: "" } },
    );
    assert.deepEqual(await jadwal(organizationId), BAWAAN);
  });

  it("satu jadwal per hari relatif; offset ±14 hari; jam kirim 06.00–21.00", async () => {
    const baru = (offsetHari: number, jamKirim: string) =>
      db.insert(schema.reminderSchedules).values({ organizationId: ORG, offsetHari, jamKirim });
    await ditolakOleh(baru(-3, "10:00"), "reminder_schedules_organisasi_offset_unik");
    await ditolakOleh(baru(-15, "09:00"), "reminder_schedules_offset");
    await ditolakOleh(baru(7, "05:59"), "reminder_schedules_jam_kirim");
    await ditolakOleh(baru(7, "21:01"), "reminder_schedules_jam_kirim");
    await baru(-7, "06:00");
    await baru(7, "21:00");
    assert.equal((await jadwal(ORG)).length, 5);
  });

  it("pengingat otomatis sekali per tagihan per jadwal; manual & kirim tagihan boleh berulang", async () => {
    const catat = (jenis: string) =>
      db.insert(schema.reminders).values({ organizationId: ORG, invoiceId: "inv_2026-09_A05", tenantId: "tnt_A05", jenis, status: "terkirim" });
    // Data contoh sudah berisi H-3, H, H+3 untuk A05.
    await ditolakOleh(catat("H-3"), "reminders_otomatis_unik");
    await catat("H-7");
    await ditolakOleh(catat("H-7"), "reminders_otomatis_unik");
    for (const jenis of ["manual", "manual", "tagihan", "tagihan"]) await catat(jenis);
  });

  it("alasan gagal kirim ikut tercatat, termasuk galat jaringan provider", async () => {
    await db.update(schema.invoices).set({ status: "lunas" }).where(eq(schema.invoices.id, "inv_2026-09_A05"));
    const waRusak = {
      provider: "uji",
      simulasi: false,
      kirim: async () => {
        throw new Error("koneksi ke provider putus");
      },
    };
    assert.equal(await kirimKonfirmasiLunas(db, "inv_2026-09_A05", { wa: waRusak, baseUrl: "https://kostera.id" }), false);
    const [log] = await db
      .select({ status: schema.reminders.status, galat: schema.reminders.galat })
      .from(schema.reminders)
      .where(and(eq(schema.reminders.invoiceId, "inv_2026-09_A05"), eq(schema.reminders.jenis, "konfirmasi_lunas")));
    assert.deepEqual(log, { status: "gagal", galat: "koneksi ke provider putus" });
  });
});
