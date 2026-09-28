// Keputusan pemeriksaan awal di proxy (tanpa akses database): ada cookie sesi atau tidak.

import { getSessionCookie } from "better-auth/cookies";

export type KeputusanProxy = "lanjut" | "ke_masuk" | "tolak_api";

export function keputusanProxy(request: Request): KeputusanProxy {
  if (getSessionCookie(request, { cookiePrefix: "kostera" })) return "lanjut";
  return new URL(request.url).pathname.startsWith("/api/") ? "tolak_api" : "ke_masuk";
}
