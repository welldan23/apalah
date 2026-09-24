import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { and, asc, eq } from "drizzle-orm";

import type { Db } from "./index.ts";
import * as schema from "./schema.ts";
import { isiDataContoh } from "./seed.ts";
import { buatDbUji } from "./testing.ts";

const ORG = "org_kos_melati";
const OWNER = "usr_ratna";

describe("skema percakapan Kosta", () => {
  let db: Db;
  let tutup: () => Promise<void>;

  /** Pastikan penolakan datang dari constraint yang dimaksud, bukan error lain. */
  const ditolakOleh = (query: Promise<unknown>, constraint: string) =>
    assert.rejects(query, (err: Error & { cause?: Error }) => {
      assert.match(err.cause?.message ?? err.message, new RegExp(constraint));
      return true;
    });

  before(async () => {
    ({ db, tutup } = await buatDbUji());
    await isiDataContoh(db);
    // Admin kos lain yang juga admin Kos Melati.
    await db.insert(schema.users).values({ id: "usr_admin", nama: "Admin", nomorWa: "6281300000001" });
    await db.insert(schema.organizations).values({ id: "org_lain", namaKos: "Kos Lain", jumlahKamar: 1, ownerId: "usr_admin" });
    await db.insert(schema.members).values([
      { organizationId: "org_lain", userId: "usr_admin", peran: "owner" },
      { organizationId: ORG, userId: "usr_admin", peran: "admin" },
    ]);
  });
  after(() => tutup());

  it("data contoh: percakapan owner Kos Melati lengkap dengan draft pengingat", async () => {
    const [wac] = await db.select().from(schema.waConversations);
    assert.equal(wac.userId, OWNER);
    assert.equal(wac.organizationId, ORG);

    const pesan = await db
      .select()
      .from(schema.waMessages)
      .where(eq(schema.waMessages.conversationId, wac.id))
      .orderBy(asc(schema.waMessages.dibuatPada), asc(schema.waMessages.id));
    assert.equal(pesan.length, 12);
    assert.deepEqual([pesan[0].arah, pesan[1].arah], ["masuk", "keluar"]);
    assert.equal(pesan.at(-1)?.lampiran?.jenis, "preview_aksi");

    const [draft] = await db.select().from(schema.actionDrafts);
    assert.equal(draft.status, "menunggu_konfirmasi");
    assert.equal(draft.ringkasanPreview.total, 1_950_000);
    assert.equal(draft.ringkasanPreview.penerima.length, 3);
  });

  it("workspace aktif harus kos tempat pengguna menjadi anggota", async () => {
    await ditolakOleh(
      db.insert(schema.waConversations).values({ nomorWa: "6281399999999", userId: OWNER, organizationId: "org_lain" }),
      "wa_conversations_workspace_anggota_fk",
    );
    await ditolakOleh(
      db.insert(schema.waConversations).values({ nomorWa: "6281399999998", organizationId: ORG }),
      "wa_conversations_workspace_butuh_user",
    );
    // Nomor belum tertaut boleh tercatat, tanpa akses ke kos mana pun.
    await db.insert(schema.waConversations).values({ nomorWa: "6281399999997" });
  });

  it("satu percakapan per nomor WA; pesan dari provider tidak tercatat dua kali", async () => {
    await ditolakOleh(
      db.insert(schema.waConversations).values({ nomorWa: "6281234567890" }),
      "wa_conversations_nomor_wa_unik",
    );
    const pesan = { conversationId: "wac_owner_kos_melati", arah: "masuk" as const, isi: "halo", idPesanProvider: "wamid.UJI1" };
    await db.insert(schema.waMessages).values(pesan);
    await ditolakOleh(db.insert(schema.waMessages).values(pesan), "wa_messages_id_provider_unik");
  });

  it("dikeluarkan dari kos: workspace aktif dikosongkan, tautan nomor tetap", async () => {
    await db.insert(schema.waConversations).values({ id: "wac_admin", nomorWa: "6281300000001", userId: "usr_admin", organizationId: ORG });
    await db
      .delete(schema.members)
      .where(and(eq(schema.members.organizationId, ORG), eq(schema.members.userId, "usr_admin")));
    const [wac] = await db.select().from(schema.waConversations).where(eq(schema.waConversations.id, "wac_admin"));
    assert.deepEqual([wac.userId, wac.organizationId], ["usr_admin", null]);
  });

  it("draft aksi: hanya anggota kos, dan waktu konfirmasi konsisten dengan status", async () => {
    const draft = {
      organizationId: ORG,
      userId: OWNER,
      jenisAksi: "tagihan" as const,
      ringkasanPreview: { aksi: "tagihan" as const, periode: "2026-10", penerima: [], total: 0 },
    };
    await ditolakOleh(
      db.insert(schema.actionDrafts).values({ ...draft, userId: "usr_admin" }),
      "action_drafts_anggota_fk",
    );
    await ditolakOleh(
      db.insert(schema.actionDrafts).values({ ...draft, status: "disetujui" }),
      "action_drafts_waktu_konfirmasi",
    );
    await ditolakOleh(
      db.insert(schema.actionDrafts).values({ ...draft, dikonfirmasiPada: new Date() }),
      "action_drafts_waktu_konfirmasi",
    );
    await db.insert(schema.actionDrafts).values({ ...draft, status: "dibatalkan", dikonfirmasiPada: new Date() });
  });

  it("verifikasi OTP: percobaan dibatasi", async () => {
    const kode = { nomorWa: "6281300000009", kodeHash: "x", kedaluwarsaPada: new Date() };
    await db.insert(schema.verifikasiWa).values(kode);
    await ditolakOleh(db.insert(schema.verifikasiWa).values({ ...kode, percobaan: 11 }), "verifikasi_wa_percobaan");
  });
});
