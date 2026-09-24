import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { pesanPengingat, pesanPengingatAwal } from "./pesan.ts";

const inv = (jatuhTempo: string) => ({
  namaPenghuni: "Yoga Saputra",
  nomorKamar: "A03",
  periode: "2026-09",
  nominal: 500_000,
  jatuhTempo,
});

describe("template pengingat", () => {
  it("sebelum jatuh tempo menyebut sisa hari", () => {
    assert.equal(
      pesanPengingatAwal(inv("2026-09-26"), "Kos Melati", "2026-09-24"),
      "Halo Yoga, pengingat dari Kos Melati: tagihan sewa kamar A03 periode September 2026 sebesar Rp500.000 jatuh tempo 26 Sep 2026 (2 hari lagi). Silakan bayar lewat link invoice berikut. Terima kasih.",
    );
    assert.match(pesanPengingatAwal(inv("2026-09-24"), "Kos Melati", "2026-09-24", "https://x/i"), /jatuh tempo hari ini\. [\s\S]*\nhttps:\/\/x\/i$/);
  });

  it("memilih template lewat jatuh tempo bila tanggalnya sudah lewat", () => {
    assert.match(pesanPengingat(inv("2026-09-20"), "Kos Melati", "2026-09-24"), /sudah lewat jatuh tempo \(20 Sep 2026\)/);
    assert.match(pesanPengingat(inv("2026-09-25"), "Kos Melati", "2026-09-24"), /1 hari lagi/);
  });
});
