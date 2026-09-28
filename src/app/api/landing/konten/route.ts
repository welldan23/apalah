// GET /api/landing/konten — konten landing publik, read-only dan tanpa login.
// Dirender statis saat build (konten hanya berubah lewat deploy).

import { kontenPublik } from "@/lib/landing/konten-publik";

export const dynamic = "force-static";

export function GET() {
  return Response.json(kontenPublik());
}
