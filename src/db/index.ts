// Koneksi database Kostera.
// - DATABASE_URL terisi → PostgreSQL sungguhan (Supabase) lewat driver postgres.js.
// - DATABASE_URL kosong → PGlite (PostgreSQL embedded) di folder lokal, supaya
//   `npm run dev` langsung jalan tanpa menyiapkan server database.
// Skema, query, dan migrasi sama persis untuk keduanya.

import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import * as schema from "./schema.ts";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

/** Folder data PGlite lokal (diabaikan git). */
export const PGLITE_DIR = process.env.PGLITE_DIR ?? ".data/pglite";

/** Produksi wajib PostgreSQL persisten — PGlite hanya untuk pengembangan lokal. */
export function pastikanBukanPgliteDiProduksi(env: Partial<Record<string, string>> = process.env) {
  if (!env.DATABASE_URL && env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL wajib diisi di produksi (PostgreSQL persisten); PGlite hanya untuk pengembangan lokal.");
  }
}

async function buatDb(): Promise<Db> {
  pastikanBukanPgliteDiProduksi();
  const url = process.env.DATABASE_URL;
  if (url) {
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { default: postgres } = await import("postgres");
    // prepare: false — wajib untuk pooler mode transaksi Supabase (port 6543).
    const client = postgres(url, { prepare: false });
    return drizzle({ client, schema, casing: "snake_case" }) as unknown as Db;
  }
  const { drizzle } = await import("drizzle-orm/pglite");
  const { PGlite } = await import("@electric-sql/pglite");
  const client = new PGlite(PGLITE_DIR);
  return drizzle({ client, schema, casing: "snake_case" }) as unknown as Db;
}

// Satu koneksi per proses; disimpan di globalThis agar tidak dibuat ulang saat hot reload.
const global = globalThis as unknown as { kosteraDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  global.kosteraDb ??= buatDb();
  return global.kosteraDb;
}

type KlienDb = { end?: () => Promise<void>; close?: () => Promise<void> };

/** Tutup koneksi — untuk skrip CLI (migrate/seed) agar proses bisa selesai. */
export async function tutupDb() {
  if (!global.kosteraDb) return;
  const db = await global.kosteraDb;
  global.kosteraDb = undefined;
  const client = (db as unknown as { $client: KlienDb }).$client;
  await (client.end ?? client.close)?.call(client);
}

export { schema };
