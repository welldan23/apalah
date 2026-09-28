CREATE TYPE "public"."aturan_jatuh_tempo" AS ENUM('tanggal_masuk', 'tanggal_tetap');--> statement-breakpoint
CREATE TABLE "invoice_items" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"label" text NOT NULL,
	"nominal" integer NOT NULL,
	CONSTRAINT "invoice_items_nominal_positif" CHECK ("invoice_items"."nominal" > 0)
);
--> statement-breakpoint
CREATE TABLE "invoice_schedules" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"aktif" boolean DEFAULT false NOT NULL,
	"tanggal_terbit" integer DEFAULT 1 NOT NULL,
	"aturan_jatuh_tempo" "aturan_jatuh_tempo" DEFAULT 'tanggal_masuk' NOT NULL,
	"tanggal_jatuh_tempo" integer,
	"diperbarui_pada" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_schedules_organisasi_unik" UNIQUE("organization_id"),
	CONSTRAINT "invoice_schedules_tanggal_terbit" CHECK ("invoice_schedules"."tanggal_terbit" between 1 and 28),
	CONSTRAINT "invoice_schedules_tanggal_jatuh_tempo" CHECK (("invoice_schedules"."aturan_jatuh_tempo" = 'tanggal_masuk' and "invoice_schedules"."tanggal_jatuh_tempo" is null)
        or ("invoice_schedules"."aturan_jatuh_tempo" = 'tanggal_tetap' and "invoice_schedules"."tanggal_jatuh_tempo" is not null
          and "invoice_schedules"."tanggal_jatuh_tempo" between 1 and 28))
);
--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_schedules" ADD CONSTRAINT "invoice_schedules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoice_items_invoice" ON "invoice_items" USING btree ("invoice_id");--> statement-breakpoint
-- Invoice yang sudah ada: satu rincian "Sewa kamar" sebesar nominalnya.
INSERT INTO "invoice_items" ("id", "invoice_id", "label", "nominal")
SELECT gen_random_uuid()::text, "id", 'Sewa kamar', "nominal" FROM "invoices";
