CREATE TABLE "kosta_audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text,
	"actor_user_id" text,
	"saluran" text NOT NULL,
	"id_pesan_masuk" text,
	"status_pengirim" text NOT NULL,
	"intent" text,
	"tool" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"action_id" text,
	"status_konfirmasi" text,
	"hasil" text NOT NULL,
	"dibuat_pada" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kosta_audit_saluran" CHECK ("kosta_audit_logs"."saluran" in ('whatsapp', 'web', 'dashboard')),
	CONSTRAINT "kosta_audit_status_pengirim" CHECK ("kosta_audit_logs"."status_pengirim" in ('tidak_dikenal', 'tanpa_akses', 'pilih_workspace', 'siap')),
	CONSTRAINT "kosta_audit_hasil" CHECK ("kosta_audit_logs"."hasil" in ('dijawab', 'klarifikasi', 'menunggu_konfirmasi', 'dijalankan', 'dibatalkan', 'ditolak', 'galat'))
);
--> statement-breakpoint
CREATE TABLE "wa_webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"status" text NOT NULL,
	"jumlah_pesan" integer DEFAULT 0 NOT NULL,
	"pesan_baru" integer DEFAULT 0 NOT NULL,
	"id_pesan_provider" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"dibuat_pada" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wa_webhook_events_provider" CHECK ("wa_webhook_events"."provider" in ('waha', 'meta', 'tidak_diketahui')),
	CONSTRAINT "wa_webhook_events_status" CHECK ("wa_webhook_events"."status" in ('diterima', 'tanda_tangan_invalid', 'payload_invalid', 'terlalu_besar')),
	CONSTRAINT "wa_webhook_events_jumlah" CHECK ("wa_webhook_events"."pesan_baru" between 0 and "wa_webhook_events"."jumlah_pesan")
);
--> statement-breakpoint
ALTER TABLE "kosta_audit_logs" ADD CONSTRAINT "kosta_audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kosta_audit_logs" ADD CONSTRAINT "kosta_audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "kosta_audit_organisasi_waktu" ON "kosta_audit_logs" USING btree ("organization_id","dibuat_pada");--> statement-breakpoint
CREATE INDEX "kosta_audit_action" ON "kosta_audit_logs" USING btree ("action_id");--> statement-breakpoint
CREATE INDEX "wa_webhook_events_waktu" ON "wa_webhook_events" USING btree ("dibuat_pada");