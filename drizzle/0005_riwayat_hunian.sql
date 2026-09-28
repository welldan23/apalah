CREATE TABLE "riwayat_hunian" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"room_id" text NOT NULL,
	"tanggal_mulai" date NOT NULL,
	"tanggal_selesai" date,
	"harga_sewa" integer NOT NULL,
	"alasan_selesai" text,
	CONSTRAINT "riwayat_hunian_harga_positif" CHECK ("riwayat_hunian"."harga_sewa" > 0),
	CONSTRAINT "riwayat_hunian_tanggal_urut" CHECK ("riwayat_hunian"."tanggal_selesai" is null or "riwayat_hunian"."tanggal_selesai" >= "riwayat_hunian"."tanggal_mulai")
);
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "alasan_keluar" text;--> statement-breakpoint
ALTER TABLE "riwayat_hunian" ADD CONSTRAINT "riwayat_hunian_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "riwayat_hunian" ADD CONSTRAINT "riwayat_hunian_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "riwayat_hunian" ADD CONSTRAINT "riwayat_hunian_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "riwayat_hunian_kamar" ON "riwayat_hunian" USING btree ("room_id","tanggal_selesai");--> statement-breakpoint
CREATE UNIQUE INDEX "riwayat_hunian_berjalan_unik" ON "riwayat_hunian" USING btree ("tenant_id") WHERE "riwayat_hunian"."tanggal_selesai" is null;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_keluar_bertanggal" CHECK ("tenants"."status" = 'aktif' or "tenants"."tanggal_keluar" is not null);--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_tanggal_keluar_urut" CHECK ("tenants"."tanggal_keluar" is null or "tenants"."tanggal_keluar" >= "tenants"."tanggal_masuk");--> statement-breakpoint
-- Penghuni yang sudah ada: satu hunian sejak tanggal masuk (selesai bila sudah keluar).
INSERT INTO "riwayat_hunian" ("id", "organization_id", "tenant_id", "room_id", "tanggal_mulai", "tanggal_selesai", "harga_sewa", "alasan_selesai")
SELECT gen_random_uuid()::text, "organization_id", "id", "room_id", "tanggal_masuk", "tanggal_keluar", "harga_sewa",
  CASE WHEN "status" = 'keluar' THEN 'keluar' END
FROM "tenants";
