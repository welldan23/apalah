import Link from "next/link";
import { ChevronRight, MessageSquareWarning } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { StatusTiket } from "@/lib/tiket";

/** Banner dashboard: ada tiket keluhan baru dari penyewa yang belum ditangani. */
export function BannerTiket({ jumlah }: { jumlah: Record<StatusTiket, number> }) {
  if (jumlah.baru === 0) return null;
  return (
    <section
      role="status"
      aria-labelledby="banner-tiket-judul"
      className="flex flex-col gap-3 rounded-xl border bg-card px-4 py-3 sm:flex-row sm:items-center"
    >
      <MessageSquareWarning className="hidden size-5 shrink-0 text-muted-foreground sm:block" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p id="banner-tiket-judul" className="font-semibold">
          {jumlah.baru} tiket keluhan baru
        </p>
        <p className="text-sm text-muted-foreground">
          Dari penyewa, belum ditangani{jumlah.diproses ? ` · ${jumlah.diproses} lainnya sedang diproses` : ""}.
        </p>
      </div>
      <Button asChild variant="outline" size="lg" className="h-11 shrink-0">
        <Link href="/tiket?status=baru">
          Lihat tiket
          <ChevronRight data-icon="inline-end" />
        </Link>
      </Button>
    </section>
  );
}
