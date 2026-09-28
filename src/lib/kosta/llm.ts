// Klien LLM untuk parsing pesan owner (API chat completions gaya OpenAI — OpenRouter / model gateway).
// LLM hanya memilih satu tool beserta parameternya; konteks minimum (teks pesan, tanggal, nama kos),
// tanpa data penyewa. Hasilnya tetap divalidasi validasiIntent sebelum dipakai.

import { ALAT } from "./intent.ts";

export type ParserLlm = {
  model: string;
  /** Hasil mentah {intent, ...parameter}; null bila LLM gagal / tidak memilih tool. */
  parse(teks: string, konteks: { hariIni: string; namaKos?: string }): Promise<Record<string, unknown> | null>;
};

export type KonfigurasiLlm = {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  fetch?: typeof fetch;
};

const BATAS_WAKTU_MS = 8_000;

const perintahSistem = ({ hariIni, namaKos }: { hariIni: string; namaKos?: string }) =>
  [
    "Kamu parser pesan WhatsApp dari owner kos di Indonesia untuk asisten Kosta.",
    "Tugasmu hanya memilih TEPAT SATU fungsi yang paling sesuai beserta parameternya. Jangan menjawab pertanyaan dan jangan mengarang angka.",
    `Hari ini ${hariIni} (WIB).${namaKos ? ` Kos yang dibahas: ${namaKos}.` : ""} Periode berformat YYYY-MM; kosongkan bila owner tidak menyebut bulan.`,
    "Nomor kamar ditulis seperti di pesan (mis. A03). Bila pesan tidak cocok dengan fungsi mana pun, pilih fungsi yang paling dekat hanya jika yakin; selain itu jangan panggil fungsi.",
  ].join("\n");

export function buatParserLlm({
  apiKey,
  baseUrl = "https://openrouter.ai/api/v1",
  model = "openai/gpt-5.4-mini",
  fetch: ambil = fetch,
}: KonfigurasiLlm): ParserLlm {
  const alamat = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const tools = ALAT.map(({ name, description, properties, required }) => ({
    type: "function",
    function: { name, description, parameters: { type: "object", properties, required: required ?? [], additionalProperties: false } },
  }));

  return {
    model,
    async parse(teks, konteks) {
      try {
        const res = await ambil(alamat, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: perintahSistem(konteks) },
              { role: "user", content: teks.slice(0, 1000) },
            ],
            tools,
            tool_choice: "auto",
          }),
          signal: AbortSignal.timeout(BATAS_WAKTU_MS),
        });
        if (!res.ok) return null;
        const data = (await res.json()) as {
          choices?: { message?: { tool_calls?: { function?: { name?: string; arguments?: string } }[] } }[];
        };
        const panggilan = data.choices?.[0]?.message?.tool_calls?.[0]?.function;
        if (!panggilan?.name) return null;
        const argumen = JSON.parse(panggilan.arguments || "{}") as Record<string, unknown>;
        return { ...argumen, intent: panggilan.name };
      } catch {
        return null;
      }
    },
  };
}

type Env = Partial<Record<string, string>>;

/** Parser LLM dari env (LLM_API_KEY, LLM_BASE_URL, LLM_MODEL); null bila belum dikonfigurasi. */
export function getParserLlm(env: Env = process.env): ParserLlm | null {
  if (!env.LLM_API_KEY) return null;
  return buatParserLlm({
    apiKey: env.LLM_API_KEY,
    baseUrl: env.LLM_BASE_URL || undefined,
    model: env.LLM_MODEL || undefined,
  });
}
