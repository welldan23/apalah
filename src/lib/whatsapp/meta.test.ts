import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getPengirimWhatsApp } from "./index.ts";
import { buatPengirimMeta } from "./meta.ts";

type Panggilan = { url: string; init: RequestInit };

function fetchPalsu(balas: () => Response | Promise<Response>) {
  const panggilan: Panggilan[] = [];
  const f = (async (url: string, init: RequestInit) => {
    panggilan.push({ url, init });
    return balas();
  }) as unknown as typeof fetch;
  return { f, panggilan };
}

const SUKSES = () => Response.json({ messaging_product: "whatsapp", messages: [{ id: "wamid.ABC" }] });

describe("buatPengirimMeta", () => {
  it("teks biasa: POST ke /{versi}/{phoneNumberId}/messages dengan Bearer token", async () => {
    const { f, panggilan } = fetchPalsu(SUKSES);
    const wa = buatPengirimMeta({ token: "rahasia", phoneNumberId: "1234", fetch: f });
    assert.deepEqual(await wa.kirim({ ke: "6281234567890", teks: "Halo" }), { ok: true, id: "wamid.ABC" });
    const [{ url, init }] = panggilan;
    assert.equal(url, "https://graph.facebook.com/v23.0/1234/messages");
    assert.equal((init.headers as Record<string, string>).Authorization, "Bearer rahasia");
    assert.deepEqual(JSON.parse(init.body as string), {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "6281234567890",
      type: "text",
      text: { body: "Halo", preview_url: true },
    });
    assert.deepEqual([wa.provider, wa.simulasi], ["meta", false]);
  });

  it("pesan bertemplate dikirim sebagai template: variabel isi + tombol URL dinamis", async () => {
    const { f, panggilan } = fetchPalsu(SUKSES);
    const wa = buatPengirimMeta({ token: "t", phoneNumberId: "1234", versiApi: "v24.0", fetch: f });
    await wa.kirim({
      ke: "6281234567890",
      teks: "diabaikan",
      template: { nama: "kostera_pengingat_lewat", bahasa: "id", variabel: ["Rizky", "Kos Melati"], tombolUrl: "demo-a05-2026-09" },
    });
    const body = JSON.parse(panggilan[0].init.body as string);
    assert.equal(panggilan[0].url, "https://graph.facebook.com/v24.0/1234/messages");
    assert.equal(body.type, "template");
    assert.equal(body.text, undefined);
    assert.deepEqual(body.template, {
      name: "kostera_pengingat_lewat",
      language: { code: "id" },
      components: [
        { type: "body", parameters: [{ type: "text", text: "Rizky" }, { type: "text", text: "Kos Melati" }] },
        { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: "demo-a05-2026-09" }] },
      ],
    });
  });

  it("penolakan Meta, HTTP gagal, atau server mati → ok false dengan alasan", async () => {
    const kirim = (balas: () => Response | Promise<Response>) =>
      buatPengirimMeta({ token: "t", phoneNumberId: "1", fetch: fetchPalsu(balas).f }).kirim({ ke: "6281234567890", teks: "x" });
    assert.deepEqual(
      await kirim(() => Response.json({ error: { message: "Template name does not exist in the translation", code: 132001 } }, { status: 404 })),
      { ok: false, galat: "Meta menolak pesan: Template name does not exist in the translation (kode 132001)." },
    );
    assert.deepEqual(await kirim(() => new Response("<html>", { status: 502 })), { ok: false, galat: "Meta menolak pesan (HTTP 502)." });
    assert.deepEqual(await kirim(() => Promise.reject(new Error("ENOTFOUND"))), {
      ok: false,
      galat: "Server WhatsApp Cloud API tidak bisa dihubungi.",
    });
  });

  it("sandbox: nomor di luar daftar uji tidak dikirim", async () => {
    const { f, panggilan } = fetchPalsu(SUKSES);
    const wa = buatPengirimMeta({ token: "t", phoneNumberId: "1", nomorUji: ["6281234567890"], fetch: f });
    assert.equal((await wa.kirim({ ke: "6281300000001", teks: "x" })).ok, false);
    assert.equal((await wa.kirim({ ke: "6281234567890", teks: "x" })).ok, true);
    assert.equal(panggilan.length, 1);
  });
});

describe("getPengirimWhatsApp meta", () => {
  it("butuh token & phone number ID", () => {
    assert.equal(getPengirimWhatsApp({ WHATSAPP_PROVIDER: "meta", META_WA_TOKEN: "t", META_WA_PHONE_NUMBER_ID: "1" }).provider, "meta");
    assert.throws(() => getPengirimWhatsApp({ WHATSAPP_PROVIDER: "meta", META_WA_TOKEN: "t" }), /META_WA_PHONE_NUMBER_ID/);
  });
});
