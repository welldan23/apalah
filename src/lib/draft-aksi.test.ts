import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { statusSetelah } from "./draft-aksi.ts";

describe("statusSetelah", () => {
  it("menunggu konfirmasi bisa disetujui atau dibatalkan", () => {
    assert.equal(statusSetelah("menunggu_konfirmasi", "setuju"), "disetujui");
    assert.equal(statusSetelah("menunggu_konfirmasi", "batal"), "dibatalkan");
  });

  it("disetujui selesai dijalankan", () => {
    assert.equal(statusSetelah("disetujui", "selesai"), "dijalankan");
  });

  it("keputusan yang tidak berlaku ditolak", () => {
    assert.equal(statusSetelah("menunggu_konfirmasi", "selesai"), null);
    assert.equal(statusSetelah("dibatalkan", "setuju"), null);
    assert.equal(statusSetelah("dijalankan", "batal"), null);
    assert.equal(statusSetelah("disetujui", "batal"), null);
  });
});
