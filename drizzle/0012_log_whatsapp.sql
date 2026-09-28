CREATE TYPE "public"."status_kirim_wa" AS ENUM('terkirim', 'gagal');--> statement-breakpoint
CREATE TABLE "whatsapp_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text,
	"tujuan" text NOT NULL,
	"jenis" text NOT NULL,
	"referensi_id" text,
	"provider" text NOT NULL,
	"template" text,
	"status" "status_kirim_wa" NOT NULL,
	"galat" text,
	"id_pesan_provider" text,
	"dibuat_pada" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_logs_jenis" CHECK ("whatsapp_logs"."jenis" in ('pengingat', 'tagihan', 'konfirmasi_lunas', 'perlu_review', 'kosta', 'otp', 'tiket')),
	CONSTRAINT "whatsapp_logs_galat_bila_gagal" CHECK (("whatsapp_logs"."status" = 'gagal') = ("whatsapp_logs"."galat" is not null))
);
--> statement-breakpoint
ALTER TABLE "whatsapp_logs" ADD CONSTRAINT "whatsapp_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "whatsapp_logs_organisasi_waktu" ON "whatsapp_logs" USING btree ("organization_id","dibuat_pada");--> statement-breakpoint
CREATE INDEX "whatsapp_logs_jenis_referensi" ON "whatsapp_logs" USING btree ("jenis","referensi_id");