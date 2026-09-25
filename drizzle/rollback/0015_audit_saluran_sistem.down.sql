-- Rollback 0015_audit_saluran_sistem: kembalikan batas saluran audit ke whatsapp/web/dashboard.
-- Entri audit bersaluran "sistem" (mis. preview kedaluwarsa dibatalkan cron) ikut dihapus.
BEGIN;
DELETE FROM "kosta_audit_logs" WHERE "saluran" = 'sistem';
ALTER TABLE "kosta_audit_logs" DROP CONSTRAINT "kosta_audit_saluran";
ALTER TABLE "kosta_audit_logs" ADD CONSTRAINT "kosta_audit_saluran" CHECK ("kosta_audit_logs"."saluran" in ('whatsapp', 'web', 'dashboard'));
DELETE FROM "drizzle"."__drizzle_migrations" WHERE "created_at" = 1790310406231;
COMMIT;
