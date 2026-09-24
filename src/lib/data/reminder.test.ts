import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import type { Db } from "../../db/index.ts";
import * as schema from "../../db/schema.ts";
import { isiDataContoh } from "../../db/seed.ts";
import { buatDbUji } from "../../db/testing.ts";
import { getKandidatReminder, getRiwayatReminder, getStatistikReminder } from "./reminder.ts";

const ORG = "org_kos_melati";

describe("data reminder", () => {
  let db: Db;
  let tutup: () => Promise<void>;
  const catat = (kamar: string, jenis: string, status: "terkirim" | "gagal", waktu: string) =>
    db.insert(schema.reminders).values({
      organizationId: ORG,
      invoiceId: `inv_2026-09_${kamar}`,
      tenantId: `tnt_${kamar}`,
      jenis,
      status,
      terkirimPada: new Date(waktu),
    });

  before(async () => {
    ({ db, tutup } = await buatDbUji());
    await isiDataContoh(db);
    // Mulai dari riwayat kosong supaya angka di test ini pasti.
    await db.delete(schema.reminders);
    await catat("A05", "H+3", "terkirim", "2026-09-18T09:00:00+07:00");
    await catat("A05", "manual", "terkirim", "2026-09-22T19:00:00+07:00");
    await catat("B06", "manual", "gagal", "2026-09-22T18:59:00+07:00");
    await catat("C05", "H-3", "terkirim", "2026-08-31T09:00:00+07:00"); // bulan kirim Agustus
    await catat("A01", "konfirmasi_lunas", "terkirim", "2026-09-02T10:00:00+07:00"); // bukan pengingat
  });
  after(() => tutup());

  it("riwayat: pengingat saja, terbaru di atas, lengkap nama & kamar", async () => {
    const riwayat = await getRiwayatReminder(db, ORG);
    assert.deepEqual(
      riwayat.map((r) => [r.nomorKamar, r.jenis, r.status]),
      [
        ["A05", "manual", "terkirim"],
        ["B06", "manual", "gagal"],
        ["A05", "H+3", "terkirim"],
        ["C05", "H-3", "terkirim"],
      ],
    );
    assert.equal(riwayat[0].namaPenghuni, "Rizky Ramadhan");
    assert.equal(riwayat[0].terkirimPada, "2026-09-22T12:00:00.000Z");
  });

  it("riwayat per bulan kirim (WIB) & batas jumlah", async () => {
    assert.deepEqual((await getRiwayatReminder(db, ORG, { periode: "2026-08" })).map((r) => r.nomorKamar), ["C05"]);
    assert.equal((await getRiwayatReminder(db, ORG, { batas: 2 })).length, 2);
  });

  it("statistik bulan kirim: terkirim, gagal, penyewa unik", async () => {
    assert.deepEqual(await getStatistikReminder(db, ORG, "2026-09"), { terkirim: 2, gagal: 1, penyewa: 1 });
    assert.deepEqual(await getStatistikReminder(db, "org_kos_mawar", "2026-09"), { terkirim: 0, gagal: 0, penyewa: 0 });
  });

  it("kandidat: tagihan belum lunas + terakhir diingatkan (yang gagal tidak dihitung)", async () => {
    const kandidat = await getKandidatReminder(db, ORG);
    assert.equal(kandidat.length, 14); // 11 menunggu + 3 jatuh tempo
    assert.ok(kandidat.every((k) => ["menunggu", "terkirim", "jatuh_tempo"].includes(k.status)));
    const peta = new Map(kandidat.map((k) => [k.nomorKamar, k.terakhirDiingatkan]));
    assert.equal(peta.get("A05"), "2026-09-22T12:00:00.000Z");
    assert.equal(peta.get("B06"), undefined);
    assert.equal(peta.get("A03"), undefined);
  });
});

