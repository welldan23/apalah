-- Rollback 0017_platform_admin: hapus peran platform admin, log-nya, dan status pilot Kosta per kos
-- (semua kos kembali memakai Kosta seperti sebelum fitur suspend).
BEGIN;
DROP TABLE IF EXISTS "platform_admin_logs";
DROP TABLE IF EXISTS "platform_admins";
DROP TABLE IF EXISTS "kosta_pilot";
DELETE FROM "drizzle"."__drizzle_migrations" WHERE "created_at" = 1790311730272;
COMMIT;
