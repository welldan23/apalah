CREATE TABLE "reminder_schedules" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"offset_hari" integer NOT NULL,
	"jam_kirim" time NOT NULL,
	"aktif" boolean DEFAULT true NOT NULL,
	"dibuat_pada" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reminder_schedules_offset" CHECK ("reminder_schedules"."offset_hari" between -14 and 14),
	CONSTRAINT "reminder_schedules_jam_kirim" CHECK ("reminder_schedules"."jam_kirim" between '06:00' and '21:00')
);
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "pengingat_otomatis" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "reminders" ADD COLUMN "galat" text;--> statement-breakpoint
ALTER TABLE "reminder_schedules" ADD CONSTRAINT "reminder_schedules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reminder_schedules_organisasi_offset_unik" ON "reminder_schedules" USING btree ("organization_id","offset_hari");--> statement-breakpoint
CREATE INDEX "reminders_organisasi_waktu" ON "reminders" USING btree ("organization_id","terkirim_pada");--> statement-breakpoint
CREATE UNIQUE INDEX "reminders_otomatis_unik" ON "reminders" USING btree ("invoice_id","jenis") WHERE "reminders"."jenis" like 'H%';--> statement-breakpoint
-- Jadwal bawaan H-3 / H / H+3 jam 09.00 WIB untuk kos yang sudah ada (sama dengan JADWAL_BAWAAN).
INSERT INTO "reminder_schedules" ("id", "organization_id", "offset_hari", "jam_kirim")
SELECT gen_random_uuid()::text, o."id", j."offset_hari", '09:00'
FROM "organizations" o CROSS JOIN (VALUES (-3), (0), (3)) AS j("offset_hari");
