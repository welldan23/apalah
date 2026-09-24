// Memahami pesan owner lalu mengarahkannya ke tool yang sesuai.
// Urutan: perintah pasti (aturan) → LLM bila dikonfigurasi → kata kunci sebagai cadangan.

import { parseCepat, parseKataKunci, validasiIntent, type Intent, type NamaIntent } from "./intent.ts";
import type { ParserLlm } from "./llm.ts";

export type HasilPaham = { intent: Intent; sumber: "aturan" | "llm" | "kata_kunci" };

export async function pahamiPesan(
  teks: string,
  { hariIni, namaKos, llm }: { hariIni: string; namaKos?: string; llm?: ParserLlm | null },
): Promise<HasilPaham> {
  const cepat = parseCepat(teks);
  if (cepat) return { intent: cepat, sumber: "aturan" };
  if (llm) {
    const mentah = await llm.parse(teks, { hariIni, namaKos });
    if (mentah) return { intent: validasiIntent(mentah), sumber: "llm" };
  }
  return { intent: parseKataKunci(teks, hariIni), sumber: "kata_kunci" };
}

export type PenanganTool<R> = {
  [K in NamaIntent]?: (intent: Extract<Intent, { intent: K }>) => Promise<R>;
};

/** Jalankan penangan untuk intent; intent tanpa penangan diteruskan ke `lainnya`. */
export function ruteTool<R>(intent: Intent, penangan: PenanganTool<R>, lainnya: (intent: Intent) => Promise<R>) {
  const fungsi = penangan[intent.intent] as ((i: Intent) => Promise<R>) | undefined;
  return fungsi ? fungsi(intent) : lainnya(intent);
}
