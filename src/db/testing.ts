// Database uji: PGlite di memori yang sudah dimigrasi. Dipakai file *.test.ts.

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import type { Db } from "./index.ts";
import * as schema from "./schema.ts";

export async function buatDbUji() {
  const client = new PGlite();
  const db = drizzle({ client, schema, casing: "snake_case" });
  await migrate(db, { migrationsFolder: "drizzle" });
  return { db: db as unknown as Db, tutup: () => client.close() };
}
