import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { asc, eq } from "drizzle-orm";

import { formatNomorTiket } from "../lib/tiket.ts";
import type { Db } from "./index.ts";
import * as schema from "./schema.ts";
import { isiDataContoh } from "./seed.ts";
import { buatDbUji } from "./testing.ts";

const ORG = "org_kos_melati";

describe("skema tiket keluhan (tickets)", () => {
  let db: Db;
  let tutup: () => Promise<void>;
  const ditolakOleh = (query: Promise<unknown>, constraint: string) =>
    assert.rejects(query, (err: Error & { cause?: Error }) => {
      assert.match(err.cause?.message ?? err.message, new RegExp(constraint));
      return true;
    });
  const tiket = (ubah: Partial<typeof schema.tickets.$inferInsert> = {}) =>
    db.insert(schema.tickets).values({
      organizationId: ORG,
      tenantId: "tnt_B06",
      roomId: "room_B06",
      nomor: 20,
      kategori: "perbaikan",
      deskripsi: "Engsel pintu lemari lepas.",
      ...ubah,
    });

  before(async () => {
    ({ db, tutup } = await buatDbUji());
    await isiDataContoh(db);
  });
  after(() => tutup());

  it("data contoh: 5 tiket Kos Melati dengan nomor, kamar, penyewa, status", async () => {
    const semua = await db.select().from(schema.tickets).where(eq(schema.tickets.organizationId, ORG)).orderBy(asc(schema.tickets.nomor));
    assert.deepEqual(
      semua.map((t) => [formatNomorTiket(t.nomor), t.roomId, t.tenantId, t.kategori, t.status]),
      [
        ["TKT-0007", "room_A05", "tnt_A05", "kebersihan", "selesai"],
        ["TKT-0010", "room_A10", "tnt_A10", "perbaikan", "diproses"],
        ["TKT-0012", "room_A05", "tnt_A05", "air_listrik", "diproses"],
        ["TKT-0013", "room_C09", "tnt_C09", "tagihan", "baru"],
        ["TKT-0014", "room_B06", "tnt_B06", "keamanan", "baru"],
      ],
    );
  });

  it("status awal baru; nomor unik per kos (kos lain boleh sama)", async () => {
    await tiket();
    const [baru] = await db.select().from(schema.tickets).where(eq(schema.tickets.nomor, 20));
    assert.equal(baru.status, "baru");
    await ditolakOleh(tiket(), "tickets_organisasi_nomor_unik");
    await ditolakOleh(tiket({ nomor: 0 }), "tickets_nomor_positif");
  });

  it("kategori harus dari daftar; cerita 10–1000 karakter (spasi di tepi tidak dihitung)", async () => {
    await ditolakOleh(tiket({ nomor: 21, kategori: "listrik" }), "tickets_kategori");
    await ditolakOleh(tiket({ nomor: 22, deskripsi: "   bocor   " }), "tickets_panjang_deskripsi");
    await ditolakOleh(tiket({ nomor: 23, deskripsi: "x".repeat(1001) }), "tickets_panjang_deskripsi");
    await tiket({ nomor: 24, deskripsi: "x".repeat(1000) });
  });
});
