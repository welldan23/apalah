CREATE TABLE "kosta_pilot" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"aktif" boolean DEFAULT true NOT NULL,
	"alasan" text,
	"diubah_oleh" text,
	"diubah_pada" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_admin_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"admin_user_id" text,
	"aksi" text NOT NULL,
	"organization_id" text,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"dibuat_pada" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_admin_logs_aksi" CHECK ("platform_admin_logs"."aksi" in ('lihat_workspace', 'suspend_pilot', 'resume_pilot', 'tambah_admin', 'hapus_admin'))
);
--> statement-breakpoint
CREATE TABLE "platform_admins" (
	"user_id" text PRIMARY KEY NOT NULL,
	"dibuat_pada" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kosta_pilot" ADD CONSTRAINT "kosta_pilot_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kosta_pilot" ADD CONSTRAINT "kosta_pilot_diubah_oleh_users_id_fk" FOREIGN KEY ("diubah_oleh") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_admin_logs" ADD CONSTRAINT "platform_admin_logs_admin_user_id_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_admin_logs" ADD CONSTRAINT "platform_admin_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_admins" ADD CONSTRAINT "platform_admins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "platform_admin_logs_waktu" ON "platform_admin_logs" USING btree ("dibuat_pada");