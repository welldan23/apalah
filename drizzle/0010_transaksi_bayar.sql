CREATE TYPE "public"."status_transaksi_bayar" AS ENUM('menunggu', 'berhasil', 'kedaluwarsa', 'gagal');--> statement-breakpoint
CREATE TABLE "payment_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"invoice_id" text NOT NULL,
	"percobaan" integer NOT NULL,
	"order_id" text NOT NULL,
	"metode" text NOT NULL,
	"nominal" integer NOT NULL,
	"status" "status_transaksi_bayar" DEFAULT 'menunggu' NOT NULL,
	"nomor_va" text,
	"qr_string" text,
	"referensi_provider" text,
	"kedaluwarsa_pada" timestamp with time zone NOT NULL,
	"dibuat_pada" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_attempts_order_unik" UNIQUE("order_id"),
	CONSTRAINT "payment_attempts_referensi_unik" UNIQUE("referensi_provider"),
	CONSTRAINT "payment_attempts_nominal_positif" CHECK ("payment_attempts"."nominal" > 0),
	CONSTRAINT "payment_attempts_percobaan_positif" CHECK ("payment_attempts"."percobaan" >= 1),
	CONSTRAINT "payment_attempts_order_id" CHECK ("payment_attempts"."order_id" = "payment_attempts"."invoice_id" || '~' || "payment_attempts"."percobaan"),
	CONSTRAINT "payment_attempts_instruksi" CHECK (("payment_attempts"."metode" = 'qris' and "payment_attempts"."qr_string" is not null) or (left("payment_attempts"."metode", 3) = 'va_' and "payment_attempts"."nomor_va" is not null))
);
--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_attempts_invoice_percobaan_unik" ON "payment_attempts" USING btree ("invoice_id","percobaan");--> statement-breakpoint
CREATE INDEX "payment_attempts_invoice_status" ON "payment_attempts" USING btree ("invoice_id","status");