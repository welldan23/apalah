import { defineConfig } from "drizzle-kit";

// Migrasi dibuat dari src/db/schema.ts ke folder drizzle/ (npm run db:generate).
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  casing: "snake_case",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
