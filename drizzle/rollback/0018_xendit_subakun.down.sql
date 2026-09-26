-- Rollback 0018_xendit_subakun: lepas sub-akun Xendit dari kos & transaksi (pembayaran online kembali
-- nonaktif), kembalikan kolom kode_perusahaan (kosong), dan batas nilai log. Log WA "pembayaran_masuk"
-- dan log admin "atur_xendit" dihapus karena tidak dikenal versi sebelumnya.
BEGIN;
DELETE FROM "whatsapp_logs" WHERE "jenis" = 'pembayaran_masuk';
DELETE FROM "platform_admin_logs" WHERE "aksi" = 'atur_xendit';
ALTER TABLE "whatsapp_logs" DROP CONSTRAINT IF EXISTS "whatsapp_logs_jenis";
ALTER TABLE "whatsapp_logs" ADD CONSTRAINT "whatsapp_logs_jenis" CHECK ("whatsapp_logs"."jenis" in ('pengingat', 'tagihan', 'konfirmasi_lunas', 'perlu_review', 'kosta', 'otp', 'tiket'));
ALTER TABLE "platform_admin_logs" DROP CONSTRAINT IF EXISTS "platform_admin_logs_aksi";
ALTER TABLE "platform_admin_logs" ADD CONSTRAINT "platform_admin_logs_aksi" CHECK ("platform_admin_logs"."aksi" in ('lihat_workspace', 'suspend_pilot', 'resume_pilot', 'tambah_admin', 'hapus_admin'));
ALTER TABLE "organizations" DROP CONSTRAINT IF EXISTS "organizations_xendit_akun_unik";
ALTER TABLE "organizations" DROP COLUMN IF EXISTS "xendit_akun_id";
ALTER TABLE "payment_attempts" DROP COLUMN IF EXISTS "akun_gateway";
ALTER TABLE "payment_attempts" ADD COLUMN IF NOT EXISTS "kode_perusahaan" text;
DELETE FROM "drizzle"."__drizzle_migrations" WHERE "created_at" = 1790393776891;
COMMIT;
