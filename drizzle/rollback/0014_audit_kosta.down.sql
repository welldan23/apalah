-- Rollback 0014_audit_kosta: hapus tabel audit Kosta & jejak webhook WhatsApp (data audit ikut hilang).
BEGIN;
DROP TABLE IF EXISTS "kosta_audit_logs";
DROP TABLE IF EXISTS "wa_webhook_events";
DELETE FROM "drizzle"."__drizzle_migrations" WHERE "created_at" = 1790309561697;
COMMIT;
