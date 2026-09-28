ALTER TABLE "platform_admin_logs" DROP CONSTRAINT "platform_admin_logs_aksi";--> statement-breakpoint
ALTER TABLE "whatsapp_logs" DROP CONSTRAINT "whatsapp_logs_jenis";--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "xendit_akun_id" text;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD COLUMN "akun_gateway" text;--> statement-breakpoint
ALTER TABLE "payment_attempts" DROP COLUMN "kode_perusahaan";--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_xendit_akun_unik" UNIQUE("xendit_akun_id");--> statement-breakpoint
ALTER TABLE "platform_admin_logs" ADD CONSTRAINT "platform_admin_logs_aksi" CHECK ("platform_admin_logs"."aksi" in ('lihat_workspace', 'suspend_pilot', 'resume_pilot', 'tambah_admin', 'hapus_admin', 'atur_xendit'));--> statement-breakpoint
ALTER TABLE "whatsapp_logs" ADD CONSTRAINT "whatsapp_logs_jenis" CHECK ("whatsapp_logs"."jenis" in ('pengingat', 'tagihan', 'konfirmasi_lunas', 'pembayaran_masuk', 'perlu_review', 'kosta', 'otp', 'tiket'));