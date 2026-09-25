CREATE TYPE "public"."status_tiket" AS ENUM('baru', 'diproses', 'selesai');--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"room_id" text NOT NULL,
	"nomor" integer NOT NULL,
	"kategori" text NOT NULL,
	"deskripsi" text NOT NULL,
	"status" "status_tiket" DEFAULT 'baru' NOT NULL,
	"dibuat_pada" timestamp with time zone DEFAULT now() NOT NULL,
	"diperbarui_pada" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tickets_nomor_positif" CHECK ("tickets"."nomor" >= 1),
	CONSTRAINT "tickets_kategori" CHECK ("tickets"."kategori" in ('perbaikan', 'air_listrik', 'kebersihan', 'keamanan', 'tagihan', 'lainnya')),
	CONSTRAINT "tickets_panjang_deskripsi" CHECK (char_length(btrim("tickets"."deskripsi")) between 10 and 1000)
);
--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tickets_organisasi_nomor_unik" ON "tickets" USING btree ("organization_id","nomor");--> statement-breakpoint
CREATE INDEX "tickets_organisasi_status" ON "tickets" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "tickets_penyewa" ON "tickets" USING btree ("tenant_id");