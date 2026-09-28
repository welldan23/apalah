CREATE TYPE "public"."arah_pesan" AS ENUM('masuk', 'keluar');--> statement-breakpoint
CREATE TYPE "public"."jenis_aksi" AS ENUM('reminder', 'tagihan');--> statement-breakpoint
CREATE TYPE "public"."status_draft_aksi" AS ENUM('menunggu_konfirmasi', 'disetujui', 'dibatalkan', 'dijalankan');--> statement-breakpoint
CREATE TABLE "action_drafts" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"conversation_id" text,
	"jenis_aksi" "jenis_aksi" NOT NULL,
	"ringkasan_preview" jsonb NOT NULL,
	"status" "status_draft_aksi" DEFAULT 'menunggu_konfirmasi' NOT NULL,
	"dibuat_pada" timestamp with time zone DEFAULT now() NOT NULL,
	"dikonfirmasi_pada" timestamp with time zone,
	CONSTRAINT "action_drafts_waktu_konfirmasi" CHECK (("action_drafts"."status" = 'menunggu_konfirmasi') = ("action_drafts"."dikonfirmasi_pada" is null))
);
--> statement-breakpoint
CREATE TABLE "verifikasi_wa" (
	"id" text PRIMARY KEY NOT NULL,
	"nomor_wa" text NOT NULL,
	"kode_hash" text NOT NULL,
	"kedaluwarsa_pada" timestamp with time zone NOT NULL,
	"percobaan" integer DEFAULT 0 NOT NULL,
	"terverifikasi_pada" timestamp with time zone,
	"dibuat_pada" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "verifikasi_wa_percobaan" CHECK ("verifikasi_wa"."percobaan" between 0 and 10)
);
--> statement-breakpoint
CREATE TABLE "wa_conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"nomor_wa" text NOT NULL,
	"user_id" text,
	"organization_id" text,
	"terakhir_pesan_pada" timestamp with time zone,
	"dibuat_pada" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wa_conversations_nomor_wa_unik" UNIQUE("nomor_wa"),
	CONSTRAINT "wa_conversations_workspace_butuh_user" CHECK ("wa_conversations"."organization_id" is null or "wa_conversations"."user_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "wa_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"organization_id" text,
	"arah" "arah_pesan" NOT NULL,
	"isi" text NOT NULL,
	"intent" text,
	"lampiran" jsonb,
	"id_pesan_provider" text,
	"dibuat_pada" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wa_messages_id_provider_unik" UNIQUE("id_pesan_provider")
);
--> statement-breakpoint
ALTER TABLE "action_drafts" ADD CONSTRAINT "action_drafts_conversation_id_wa_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."wa_conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_drafts" ADD CONSTRAINT "action_drafts_anggota_fk" FOREIGN KEY ("organization_id","user_id") REFERENCES "public"."members"("organization_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wa_conversations" ADD CONSTRAINT "wa_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wa_conversations" ADD CONSTRAINT "wa_conversations_workspace_anggota_fk" FOREIGN KEY ("organization_id","user_id") REFERENCES "public"."members"("organization_id","user_id") ON DELETE SET NULL ("organization_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wa_messages" ADD CONSTRAINT "wa_messages_conversation_id_wa_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."wa_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wa_messages" ADD CONSTRAINT "wa_messages_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "action_drafts_organisasi_status" ON "action_drafts" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "verifikasi_wa_nomor" ON "verifikasi_wa" USING btree ("nomor_wa","dibuat_pada");--> statement-breakpoint
CREATE INDEX "wa_messages_percakapan_waktu" ON "wa_messages" USING btree ("conversation_id","dibuat_pada");