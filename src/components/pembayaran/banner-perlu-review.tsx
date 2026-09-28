import Link from "next/link";
import { ChevronRight, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatRupiah } from "@/lib/format";
import type { PembayaranPerluReview } from "@/lib/types";

/** Banner notifikasi: ada pembayaran yang nominalnya tidak cocok dan perlu diperiksa owner. */
export function BannerPerluReview({ items }: { items: PembayaranPerluReview[] }) {
  if (items.length === 0) return null;
  const [pertama] = items;
  const selisih = pertama.dibayar - pertama.nominal;

  return (
    <section
      role="status"
      aria-labelledby="banner-review-judul"
      className="flex flex-col gap-3 rounded-xl border border-warning/40 bg-warning-soft px-4 py-3 sm:flex-row sm:items-center"
    >
      <TriangleAlert className="hidden size-5 shrink-0 text-warning sm:block" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p id="banner-review-judul" className="font-semibold text-warning">
          {items.length} pembayaran perlu diperiksa
        </p>
        <p className="text-sm text-foreground/80">
          {pertama.nomorKamar} · {pertama.namaPenghuni} membayar {formatRupiah(pertama.dibayar)} untuk
          tagihan {formatRupiah(pertama.nominal)} ({selisih < 0 ? "kurang" : "lebih"}{" "}
          {formatRupiah(Math.abs(selisih))}).
          {items.length > 1 && ` Ada ${items.length - 1} lainnya.`}
        </p>
      </div>
      <Button asChild variant="outline" size="lg" className="h-11 shrink-0 bg-card">
        <Link href="/pembayaran?status=perlu_review">
          Periksa
          <ChevronRight data-icon="inline-end" />
        </Link>
      </Button>
    </section>
  );
}
