import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buatParserLlm, getParserLlm, type ParserLlm } from "./llm.ts";
import { pahamiPesan, ruteTool } from "./router.ts";

const HARI_INI = "2026-09-24";

/** Balasan chat completions dengan satu tool call. */
const balasanTool = (name: string, args: Record<string, unknown>) =>
  Response.json({ choices: [{ message: { tool_calls: [{ type: "function", function: { name, arguments: JSON.stringify(args) } }] } }] });

describe("buatParserLlm", () => {
  it("mengirim teks + tool terbatas, lalu membaca tool call", async () => {
    let permintaan: { url: string; init: RequestInit } | undefined;
    const llm = buatParserLlm({
      apiKey: "kunci",
      model: "openai/gpt-5.4-mini",
      fetch: (async (url: string, init: RequestInit) => {
        permintaan = { url, init };
        return balasanTool("cek_kamar", { nomorKamar: "A03" });
      }) as unknown as typeof fetch,
    });
    assert.deepEqual(await llm.parse("A03 udah transfer?", { hariIni: HARI_INI, namaKos: "Kos Melati" }), {
      nomorKamar: "A03",
      intent: "cek_kamar",
    });

    assert.equal(permintaan?.url, "https://openrouter.ai/api/v1/chat/completions");
    assert.equal((permintaan?.init.headers as Record<string, string>).Authorization, "Bearer kunci");
    const body = JSON.parse(permintaan?.init.body as string);
    assert.equal(body.model, "openai/gpt-5.4-mini");
    assert.equal(body.messages.length, 2);
    assert.match(body.messages[0].content, /Hari ini 2026-09-24/);
    assert.equal(body.messages[1].content, "A03 udah transfer?");
    assert.ok(body.tools.some((t: { function: { name: string } }) => t.function.name === "lihat_tunggakan"));
  });

  it("galat HTTP, jaringan, atau tanpa tool call → null", async () => {
    const dengan = (balas: () => Promise<Response>) =>
      buatParserLlm({ apiKey: "k", fetch: balas as unknown as typeof fetch }).parse("x", { hariIni: HARI_INI });
    assert.equal(await dengan(async () => new Response("", { status: 429 })), null);
    assert.equal(await dengan(async () => { throw new Error("timeout"); }), null);
    assert.equal(await dengan(async () => Response.json({ choices: [{ message: { content: "halo" } }] })), null);
    assert.equal(await dengan(async () => Response.json({ choices: [{ message: { tool_calls: [{ function: { name: "x", arguments: "{rusak" } }] } }] })), null);
  });

  it("getParserLlm: tanpa LLM_API_KEY → null", () => {
    assert.equal(getParserLlm({}), null);
    assert.equal(getParserLlm({ LLM_API_KEY: "k", LLM_MODEL: "openai/gpt-5.4-nano" })?.model, "openai/gpt-5.4-nano");
  });
});

describe("pahamiPesan", () => {
  const llmPalsu = (hasil: Record<string, unknown> | null) => {
    const dipanggil: string[] = [];
    const llm: ParserLlm = { model: "palsu", async parse(teks) { dipanggil.push(teks); return hasil; } };
    return { llm, dipanggil };
  };

  it("perintah pasti tidak memanggil LLM", async () => {
    const { llm, dipanggil } = llmPalsu({ intent: "kamar_kosong" });
    assert.deepEqual(await pahamiPesan("ya", { hariIni: HARI_INI, llm }), { intent: { intent: "konfirmasi", setuju: true }, sumber: "aturan" });
    assert.equal(dipanggil.length, 0);
  });

  it("kalimat bebas lewat LLM, hasilnya divalidasi", async () => {
    const { llm } = llmPalsu({ intent: "lihat_tunggakan", periode: "2026-09", catatan: "abaikan" });
    assert.deepEqual(await pahamiPesan("siapa aja yg belum transfer", { hariIni: HARI_INI, llm }), {
      intent: { intent: "lihat_tunggakan", periode: "2026-09" },
      sumber: "llm",
    });
  });

  it("LLM gagal atau belum dikonfigurasi → kata kunci", async () => {
    const { llm } = llmPalsu(null);
    assert.deepEqual(await pahamiPesan("kamar kosong ada berapa", { hariIni: HARI_INI, llm }), {
      intent: { intent: "kamar_kosong" },
      sumber: "kata_kunci",
    });
    assert.equal((await pahamiPesan("rekap pemasukan", { hariIni: HARI_INI })).sumber, "kata_kunci");
  });
});

describe("ruteTool", () => {
  it("memanggil penangan sesuai intent; tanpa penangan → lainnya", async () => {
    const penangan = { kamar_kosong: async () => "daftar kamar kosong", cek_kamar: async (i: { nomorKamar: string }) => `cek ${i.nomorKamar}` };
    const lainnya = async () => "belum bisa";
    assert.equal(await ruteTool({ intent: "cek_kamar", nomorKamar: "A03" }, penangan, lainnya), "cek A03");
    assert.equal(await ruteTool({ intent: "kamar_kosong" }, penangan, lainnya), "daftar kamar kosong");
    assert.equal(await ruteTool({ intent: "bantuan" }, penangan, lainnya), "belum bisa");
  });
});
