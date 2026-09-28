-- Rollback 0016_jenis_aksi_hunian: hapus nilai 'pindah_kamar' & 'keluar_penghuni' dari enum jenis_aksi.
-- PostgreSQL tidak bisa menghapus nilai enum, jadi tipe dibuat ulang. Draft aksi hunian ikut dihapus.
BEGIN;
DELETE FROM "action_drafts" WHERE "jenis_aksi" IN ('pindah_kamar', 'keluar_penghuni');
ALTER TYPE "public"."jenis_aksi" RENAME TO "jenis_aksi_lama";
CREATE TYPE "public"."jenis_aksi" AS ENUM ('reminder', 'tagihan');
ALTER TABLE "action_drafts" ALTER COLUMN "jenis_aksi" TYPE "public"."jenis_aksi" USING "jenis_aksi"::text::"public"."jenis_aksi";
DROP TYPE "public"."jenis_aksi_lama";
DELETE FROM "drizzle"."__drizzle_migrations" WHERE "created_at" = 1790311231469;
COMMIT;
