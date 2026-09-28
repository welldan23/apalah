import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { eq } from "drizzle-orm";

import type { Db } from "../../db/index.ts";
import * as schema from "../../db/schema.ts";
import { isiDataContoh } from "../../db/seed.ts";
import { buatDbUji } from "../../db/testing.ts";
import type { HasilKirim, PengirimWhatsApp } from "./index.ts";
import { kirimDanCatat } from "./log.ts";

const ORG = "org_kos_melati";

const waUji = (kirim: () => Promise<HasilKirim>): PengirimWhatsApp => ({ provider: "uji", simulasi: false, kirim });

describe("log pengiriman WhatsApp (whatsapp_logs)", () => {
  let db: Db;
  let tutup: () => Promise<void>;
  const logUntuk = (tujuan: string) => db.select().from(schema.whatsappLogs).where(eq(schema.whatsappLogs.tujuan, tujuan));
  const ditolakOleh = (query: Promise<unknown>, constraint: string) =>
    assert.rejects(query, (err: Error & { cause?: Error }) => {
      assert.match(err.cause?.message ?? err.message, new RegExp(constraint));
      return true;
    });

  before(async () => {
    ({ db, tutup } = await buatDbUji());
    await isiDataContoh(db);
  });
  after(() => tutup());

  it("kiriman berhasil dicatat dengan provider, template & ID pesan — tanpa isi pesan", async () => {
    const wa = waUji(async () => ({ ok: true, id: "wamid.XYZ" }));
    const hasil = await kirimDanCatat(
      db,
      wa,
      {
        ke: "6281200000001",
        teks: "Halo Rizky, tagihan kamar A05 Rp1.500.000",
        template: { nama: "kostera_pengingat_lewat", bahasa: "id", variabel: ["Rizky"] },
      },
      { jenis: "pengingat", organizationId: ORG, referensiId: "rem_1" },
    );
    assert.deepEqual(hasil, { ok: true, id: "wamid.XYZ" });
    const [log] = await logUntuk("6281200000001");
    assert.deepEqual(
      [log.organizationId, log.jenis, log.referensiId, log.provider, log.template, log.status, log.galat, log.idPesanProvider],
      [ORG, "pengingat", "rem_1", "uji", "kostera_pengingat_lewat", "terkirim", null, "wamid.XYZ"],
    );
    assert.ok(log.dibuatPada instanceof Date);
    assert.ok(!JSON.stringify(log).includes("Rizky"));
  });

  it("provider melempar galat → tidak ikut melempar, tercatat gagal beserta galatnya", async () => {
    const wa = waUji(async () => {
      throw new Error("koneksi ke provider putus");
    });
    const hasil = await kirimDanCatat(db, wa, { ke: "6281200000002", teks: "Tagihan lunas" }, { jenis: "konfirmasi_lunas" });
    assert.deepEqual(hasil, { ok: false, galat: "koneksi ke provider putus" });
    const [log] = await logUntuk("6281200000002");
    assert.deepEqual(
      [log.organizationId, log.referensiId, log.template, log.status, log.galat, log.idPesanProvider],
      [null, null, null, "gagal", "koneksi ke provider putus", null],
    );
  });

  it("log gagal ditulis → hasil kiriman tetap dikembalikan", async (t) => {
    const galatLog = t.mock.method(console, "error", () => {});
    const dbRusak = {
      insert: () => {
        throw new Error("database tidak bisa dihubungi");
      },
    } as unknown as Pick<Db, "insert">;
    const hasil = await kirimDanCatat(dbRusak, waUji(async () => ({ ok: true })), { ke: "6281200000003", teks: "Halo" }, { jenis: "kosta" });
    assert.deepEqual(hasil, { ok: true });
    assert.equal(galatLog.mock.callCount(), 1);
  });

  it("jenis di luar daftar ditolak; galat wajib ada hanya untuk kiriman gagal", async () => {
    const baris = (ubah: Partial<typeof schema.whatsappLogs.$inferInsert>) =>
      db.insert(schema.whatsappLogs).values({ tujuan: "6281200000009", jenis: "tagihan", provider: "uji", status: "terkirim", ...ubah });
    await ditolakOleh(baris({ jenis: "promo" }), "whatsapp_logs_jenis");
    await ditolakOleh(baris({ status: "gagal" }), "whatsapp_logs_galat_bila_gagal");
    await ditolakOleh(baris({ galat: "nomor tidak aktif" }), "whatsapp_logs_galat_bila_gagal");
    await baris({ status: "gagal", galat: "nomor tidak aktif" });
  });

  it("log ikut terhapus bersama kosnya", async () => {
    await db.insert(schema.organizations).values({ id: "org_hapus", namaKos: "Kos Sementara", jumlahKamar: 0, ownerId: "usr_ratna" });
    await kirimDanCatat(db, waUji(async () => ({ ok: true })), { ke: "6281200000004", teks: "Halo" }, { jenis: "tagihan", organizationId: "org_hapus" });
    await db.delete(schema.organizations).where(eq(schema.organizations.id, "org_hapus"));
    assert.equal((await logUntuk("6281200000004")).length, 0);
  });
});
