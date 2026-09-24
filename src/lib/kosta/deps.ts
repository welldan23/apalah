// Dependensi Kosta dari environment (adapter WhatsApp, parser LLM, alamat situs, tanggal WIB).

import { hariIniWib } from "../waktu.ts";
import { getPengirimWhatsApp } from "../whatsapp/index.ts";
import { getParserLlm } from "./llm.ts";
import type { DepsKosta } from "./proses-pesan.ts";

export function getDepsKosta(request: Request): DepsKosta {
  return {
    wa: getPengirimWhatsApp(),
    llm: getParserLlm(),
    baseUrl: process.env.APP_URL ?? new URL(request.url).origin,
    hariIni: hariIniWib(),
  };
}
