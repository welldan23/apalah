import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import type { Db } from "../../db/index.ts";
import * as schema from "../../db/schema.ts";
import { isiDataContoh } from "../../db/seed.ts";
import { buatDbUji } from "../../db/testing.ts";
import { catatAuditKosta } from "../kosta/audit.ts";
import { aturPilotKosta } from "../platform/konsol.ts";
import { getKontrolKosta } from "./kontrol-kosta.ts";

const SEKARANG = new Date("2026-09-24T09:00:00+07:00");

describe("kontrol Kosta di dashboard owner", () => {
  let db: Db;
  let tutup: () => Promise<void>;

  beforeEach(async () => {
    ({ db, tutup } = await buatDbUji());
    await isiDataContoh(db);
  });
  afterEach(() => tutup());

  it("kos aktif: nomor tertaut, aksi menunggu (tanpa ID internal), riwayat aksi relevan", async () => {
    await catatAuditKosta(db, { saluran: "whatsapp", statusPengirim: "siap", organizationId: "org_kos_melati", intent: "list_arrears", hasil: "dijawab" });
    await catatAuditKosta(db, { saluran: "whatsapp", statusPengirim: "siap", organizationId: "org_kos_melati", intent: "prepare_reminder", hasil: "menunggu_konfirmasi" });
    const k = await getKontrolKosta(db, { organizationId: "org_kos_melati", userId: "usr_ratna", sekarang: SEKARANG, env: { WHATSAPP_PROVIDER: "waha" } });
    assert.deepEqual([k.nomorWa, k.nomorTerverifikasi, k.pilot.aktif], ["6281234567890", true, true]);
    assert.deepEqual([k.kanal.produksi, k.kanal.mode], [false, "pilot/sandbox (WAHA)"]);
    assert.equal(k.aksiMenunggu.length, 1);
    assert.equal(k.aksiMenunggu[0].draftId, "draft_reminder_2026-09");
    assert.ok(!JSON.stringify(k.aksiMenunggu).includes("invoiceIds") && !JSON.stringify(k.aksiMenunggu).includes("inv_"));
    // Hanya aksi yang relevan (pertanyaan baca tidak masuk riwayat).
    assert.deepEqual(k.riwayat.map((r) => [r.label, r.hasil]), [["Siapkan reminder", "menunggu konfirmasi"]]);
  });

  it("isolasi: kos lain tidak melihat aksi Kos Melati; aksi kedaluwarsa tidak ditampilkan", async () => {
    const griya = await getKontrolKosta(db, { organizationId: "org_griya_asri", userId: "usr_pemilik_griya", sekarang: SEKARANG });
    assert.deepEqual([griya.aksiMenunggu, griya.riwayat], [[], []]);
    const lusa = await getKontrolKosta(db, { organizationId: "org_kos_melati", userId: "usr_ratna", sekarang: new Date("2026-09-26T09:00:00+07:00") });
    assert.equal(lusa.aksiMenunggu.length, 0);
  });

  it("pilot disuspend terlihat oleh owner beserta alasannya; kanal Cloud API = produksi", async () => {
    await aturPilotKosta(db, { organizationId: "org_kos_melati", aktif: false, alasan: "nomor WAHA diblokir", adminUserId: "usr_pemilik_griya" });
    const k = await getKontrolKosta(db, { organizationId: "org_kos_melati", userId: "usr_ratna", sekarang: SEKARANG, env: { WHATSAPP_PROVIDER: "meta" } });
    assert.deepEqual(k.pilot, { aktif: false, alasan: "nomor WAHA diblokir" });
    assert.equal(k.kanal.produksi, true);
    assert.equal((await db.select().from(schema.kostaPilot)).length, 1);
  });
});
