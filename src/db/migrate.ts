// Jalankan migrasi SQL di folder drizzle/ ke database aktif (Supabase atau PGlite lokal).
// Pakai: npm run db:migrate. Aman diulang — migrasi yang sudah jalan dilewati.

import { mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { PGLITE_DIR, pastikanBukanPgliteDiProduksi } from "./index.ts";

const MIGRATIONS = { migrationsFolder: "drizzle" };

export async function jalankanMigrasi() {
  pastikanBukanPgliteDiProduksi();
  const url = process.env.DATABASE_URL;
  if (url) {
    const { default: postgres } = await import("postgres");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    const client = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
    try {
      await migrate(drizzle({ client }), MIGRATIONS);
    } finally {
      await client.end();
    }
    return "PostgreSQL (DATABASE_URL)";
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  mkdirSync(PGLITE_DIR, { recursive: true });
  const client = new PGlite(PGLITE_DIR);
  try {
    await migrate(drizzle({ client }), MIGRATIONS);
  } finally {
    await client.close();
  }
  return `PGlite lokal (${PGLITE_DIR})`;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const target = await jalankanMigrasi();
  console.log(`✓ Migrasi selesai — ${target}`);
}
