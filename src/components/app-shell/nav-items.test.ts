import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { navUntukPeran } from "./nav-items.ts";

describe("menu sesuai peran", () => {
  const label = (peran: Parameters<typeof navUntukPeran>[0]) => navUntukPeran(peran).map((i) => i.label);

  it("owner melihat semua menu pengelola termasuk Pengaturan", () => {
    assert.deepEqual(label("owner"), [
      "Dashboard",
      "Tagihan & Invoice",
      "Kamar & Penghuni",
      "Pembayaran",
      "Reminder",
      "Chat Kosta",
      "Tiket keluhan",
      "Pengaturan",
    ]);
  });

  it("admin: menu operasional tanpa Pengaturan", () => {
    assert.deepEqual(label("admin"), [
      "Dashboard",
      "Tagihan & Invoice",
      "Kamar & Penghuni",
      "Pembayaran",
      "Reminder",
      "Chat Kosta",
      "Tiket keluhan",
    ]);
  });

  it("penyewa hanya tagihannya sendiri & tiket, tanpa data kos", () => {
    assert.deepEqual(label("penyewa"), ["Tagihan saya", "Tiket keluhan"]);
  });

  it("bottom nav HP maksimal 5 menu untuk tiap peran", () => {
    for (const peran of ["owner", "admin", "penyewa"] as const) {
      assert.ok(navUntukPeran(peran).filter((i) => i.mobile).length <= 5, peran);
    }
  });
});
