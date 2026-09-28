CREATE TYPE "public"."status_reminder" AS ENUM('terkirim', 'gagal');--> statement-breakpoint
CREATE TABLE "reminders" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"invoice_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"jenis" text NOT NULL,
	"kanal" text DEFAULT 'whatsapp' NOT NULL,
	"status" "status_reminder" NOT NULL,
	"terkirim_pada" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reminders_invoice" ON "reminders" USING btree ("invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_penghuni_periode_unik" ON "invoices" USING btree ("tenant_id","periode");