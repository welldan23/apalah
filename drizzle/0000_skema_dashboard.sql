CREATE TYPE "public"."peran" AS ENUM('owner', 'admin', 'penyewa');--> statement-breakpoint
CREATE TYPE "public"."status_invoice" AS ENUM('draft', 'terkirim', 'menunggu', 'lunas', 'jatuh_tempo', 'perlu_review');--> statement-breakpoint
CREATE TYPE "public"."status_kamar" AS ENUM('terisi', 'kosong');--> statement-breakpoint
CREATE TYPE "public"."status_member" AS ENUM('aktif', 'nonaktif');--> statement-breakpoint
CREATE TYPE "public"."status_pembayaran" AS ENUM('pending', 'valid', 'tidak_cocok');--> statement-breakpoint
CREATE TYPE "public"."status_penghuni" AS ENUM('aktif', 'keluar');--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"room_id" text NOT NULL,
	"periode" text NOT NULL,
	"nominal" integer NOT NULL,
	"jatuh_tempo" date NOT NULL,
	"status" "status_invoice" DEFAULT 'draft' NOT NULL,
	"token_publik" text NOT NULL,
	"diterbitkan_pada" timestamp with time zone DEFAULT now() NOT NULL,
	"dibayar_pada" timestamp with time zone,
	CONSTRAINT "invoices_token_publik_unik" UNIQUE("token_publik"),
	CONSTRAINT "invoices_nominal_positif" CHECK ("invoices"."nominal" > 0),
	CONSTRAINT "invoices_format_periode" CHECK ("invoices"."periode" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"peran" "peran" NOT NULL,
	"status" "status_member" DEFAULT 'aktif' NOT NULL,
	"dibuat_pada" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"nama_kos" text NOT NULL,
	"alamat" text DEFAULT '' NOT NULL,
	"jumlah_kamar" integer NOT NULL,
	"owner_id" text NOT NULL,
	"dibuat_pada" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_jumlah_kamar_positif" CHECK ("organizations"."jumlah_kamar" > 0)
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"nominal_dibayar" integer NOT NULL,
	"metode" text NOT NULL,
	"provider" text NOT NULL,
	"referensi_provider" text NOT NULL,
	"status" "status_pembayaran" DEFAULT 'pending' NOT NULL,
	"diverifikasi_pada" timestamp with time zone,
	CONSTRAINT "payments_referensi_provider_unik" UNIQUE("referensi_provider"),
	CONSTRAINT "payments_nominal_positif" CHECK ("payments"."nominal_dibayar" > 0)
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"nomor_kamar" text NOT NULL,
	"tipe" text NOT NULL,
	"harga_sewa" integer NOT NULL,
	"status" "status_kamar" DEFAULT 'kosong' NOT NULL,
	"catatan" text,
	CONSTRAINT "rooms_harga_sewa_positif" CHECK ("rooms"."harga_sewa" > 0)
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text,
	"nama" text NOT NULL,
	"nomor_wa" text NOT NULL,
	"room_id" text NOT NULL,
	"tanggal_masuk" date NOT NULL,
	"tanggal_keluar" date,
	"status" "status_penghuni" DEFAULT 'aktif' NOT NULL,
	"harga_sewa" integer NOT NULL,
	CONSTRAINT "tenants_harga_sewa_positif" CHECK ("tenants"."harga_sewa" > 0)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"nama" text NOT NULL,
	"nomor_wa" text NOT NULL,
	"nomor_wa_terverifikasi" boolean DEFAULT false NOT NULL,
	"email" text,
	CONSTRAINT "users_nomor_wa_unik" UNIQUE("nomor_wa")
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoices_organisasi_periode" ON "invoices" USING btree ("organization_id","periode");--> statement-breakpoint
CREATE UNIQUE INDEX "members_organisasi_user_unik" ON "members" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "payments_invoice" ON "payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rooms_organisasi_nomor_unik" ON "rooms" USING btree ("organization_id","nomor_kamar");--> statement-breakpoint
CREATE INDEX "tenants_organisasi" ON "tenants" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tenants_kamar_aktif_unik" ON "tenants" USING btree ("room_id") WHERE "tenants"."status" = 'aktif';