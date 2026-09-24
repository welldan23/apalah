ALTER TABLE "organizations" DROP CONSTRAINT "organizations_jumlah_kamar_positif";--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "aktif" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_jumlah_kamar_tidak_negatif" CHECK ("organizations"."jumlah_kamar" >= 0);--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_nonaktif_kosong" CHECK ("rooms"."aktif" or "rooms"."status" = 'kosong');