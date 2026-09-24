import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getPengirimWhatsApp } from "./index.ts";
import { buatPengirimWaha } from "./waha.ts";

type Panggilan = { url: string; init: RequestInit };

/** fetch palsu yang mencatat permintaan dan membalas sesuai `balas`. */
function fetchPalsu(balas: () => Response | Promise<Response>) {
  const panggilan: Panggilan[] = [];
  const f = (async (url: string, init: RequestInit) => {
    panggilan.push({ url, init });
    return balas();
  }) as unknown as typeof fetch;
  return { f, panggilan };
}

describe("buatPengirimWaha", () => {
  it("mengirim teks ke /api/sendText dengan chatId @c.us dan X-Api-Key", async () => {
    const { f, panggilan } = fetchPalsu(() => Response.json({ id: "true_6281234567890@c.us_XYZ" }, { status: 201 }));
    const wa = buatPengirimWaha({ url: "http://waha:3000/", apiKey: "kunci", session: "kostera", fetch: f });
    assert.deepEqual(await wa.kirim({ ke: "6281234567890", teks: "Halo" }), { ok: true, id: "true_6281234567890@c.us_XYZ" });

    const [{ url, init }] = panggilan;
    assert.equal(url, "http://waha:3000/api/sendText");
    assert.equal(init.method, "POST");
    assert.equal((init.headers as Record<string, string>)["X-Api-Key"], "kunci");
    assert.deepEqual(JSON.parse(init.body as string), { session: "kostera", chatId: "6281234567890@c.us", text: "Halo" });
    assert.equal(wa.simulasi, false);
  });

  it("HTTP gagal atau server mati → ok false dengan alasan", async () => {
    const tolak = buatPengirimWaha({ url: "http://waha", fetch: fetchPalsu(() => new Response("", { status: 422 })).f });
    assert.deepEqual(await tolak.kirim({ ke: "6281234567890", teks: "x" }), { ok: false, galat: "WAHA menolak pesan (HTTP 422)." });
    const mati = buatPengirimWaha({ url: "http://waha", fetch: fetchPalsu(() => Promise.reject(new Error("ECONNREFUSED"))).f });
    assert.equal((await mati.kirim({ ke: "6281234567890", teks: "x" })).ok, false);
  });

  it("sandbox: nomor di luar daftar uji tidak dikirim", async () => {
    const { f, panggilan } = fetchPalsu(() => Response.json({}));
    const wa = buatPengirimWaha({ url: "http://waha", nomorUji: ["6281234567890"], fetch: f });
    assert.equal((await wa.kirim({ ke: "6281300000001", teks: "x" })).ok, false);
    assert.equal((await wa.kirim({ ke: "6281234567890", teks: "x" })).ok, true);
    assert.equal(panggilan.length, 1);
  });
});

describe("getPengirimWhatsApp", () => {
  it("bawaan log (simulasi); waha butuh WAHA_URL; provider asing ditolak", () => {
    assert.equal(getPengirimWhatsApp({}).provider, "log");
    assert.equal(getPengirimWhatsApp({}).simulasi, true);
    assert.equal(getPengirimWhatsApp({ WHATSAPP_PROVIDER: "waha", WAHA_URL: "http://waha" }).provider, "waha");
    assert.throws(() => getPengirimWhatsApp({ WHATSAPP_PROVIDER: "waha" }), /WAHA_URL/);
    assert.throws(() => getPengirimWhatsApp({ WHATSAPP_PROVIDER: "twilio" }), /belum didukung/);
  });
});
