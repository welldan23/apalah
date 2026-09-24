CREATE TABLE "webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"event_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"diterima_pada" timestamp with time zone DEFAULT now() NOT NULL,
	"diproses_pada" timestamp with time zone,
	"hasil" text
);
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "webhook_event_id" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "dibuat_pada" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_provider_event_unik" ON "webhook_events" USING btree ("provider","event_id");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_webhook_event_id_webhook_events_id_fk" FOREIGN KEY ("webhook_event_id") REFERENCES "public"."webhook_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_webhook_event_unik" UNIQUE("webhook_event_id");--> statement-breakpoint
-- Pembayaran lama: waktu dicatat = waktu verifikasi.
UPDATE "payments" SET "dibuat_pada" = "diverifikasi_pada" WHERE "diverifikasi_pada" IS NOT NULL;
