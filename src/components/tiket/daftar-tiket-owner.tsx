"use client";

import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { CircleCheck, CircleDot, Clock, MessageCircle } from "lucide-react";

import { CatatanSimulasi } from "@/components/quick-actions/action-sheet";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatWaktu } from "@/lib/format";
import {
  hitungTiket,
  labelKategori,
  LABEL_STATUS_TIKET,
  statusBerikutnya,
  type StatusTiket,
  type TiketKos,
} from "@/lib/tiket";
import { cn } from "@/lib/utils";

const BADGE = {
  baru: { tone: "neutral", icon: CircleDot },
  diproses: { tone: "warning", icon: Clock },
  selesai: { tone: "success", icon: CircleCheck },
} as const satisfies Record<StatusTiket, unknown>;

const AKSI: Record<Exclude<StatusTiket, "baru">, string> = { diproses: "Mulai tangani", selesai: "Tandai selesai" };

type Saringan = "semua" | StatusTiket;
const SARINGAN: Saringan[] = ["semua", "baru", "diproses", "selesai"];
const parseSaringan = (nilai: string | null): Saringan => (SARINGAN.includes(nilai as Saringan) ? (nilai as Saringan) : "semua");

/**
 * Tiket keluhan penyewa untuk owner/admin: saring per status (disimpan di URL), lalu tangani —
 * Baru → Diproses → Selesai — atau hubungi penyewanya lewat WhatsApp.
 * Tahap frontend: perubahan status hanya di layar (PATCH /api/dashboard/tiket/[id] menyusul).
 */
export function DaftarTiketOwner({ tiket: awal }: { tiket: TiketKos[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const saringan = parseSaringan(searchParams.get("status"));
  const [tiket, setTiket] = useState(awal);
  const [diubah, setDiubah] = useState(false);
  const jumlah = hitungTiket(tiket);

  function saring(s: Saringan) {
    const params = new URLSearchParams(window.location.search);
    if (s === "semua") params.delete("status");
    else params.set("status", s);
    const query = params.toString();
    window.history.replaceState(null, "", `${pathname}${query ? `?${query}` : ""}`);
  }

  function ubahStatus(id: string, status: StatusTiket) {
    const sekarang = new Date().toISOString();
    setTiket((daftar) => daftar.map((t) => (t.id === id ? { ...t, status, diperbaruiPada: sekarang } : t)));
    setDiubah(true);
  }

  const tampil = saringan === "semua" ? tiket : tiket.filter((t) => t.status === saringan);

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="Saring status tiket" className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
        {SARINGAN.map((s) => {
          const aktif = saringan === s;
          const n = s === "semua" ? tiket.length : jumlah[s];
          return (
            <button
              key={s}
              type="button"
              aria-pressed={aktif}
              onClick={() => saring(s)}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                aktif ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {s === "semua" ? "Semua" : LABEL_STATUS_TIKET[s]}
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs tabular-nums",
                  aktif ? "bg-primary-foreground/15" : "bg-card",
                  !aktif && s === "baru" && n > 0 && "text-danger",
                )}
              >
                {n}
              </span>
            </button>
          );
        })}
      </div>

      {diubah && <CatatanSimulasi>Mode contoh: perubahan status belum tersimpan ke server.</CatatanSimulasi>}

      {tampil.length === 0 ? (
        <Card className="items-center gap-1 px-4 py-12 text-center shadow-none">
          <p className="font-medium">{tiket.length === 0 ? "Belum ada tiket dari penyewa" : "Tidak ada tiket di status ini"}</p>
          <p className="text-sm text-muted-foreground">
            Penyewa bisa melaporkan masalah lewat tautan invoice mereka.
          </p>
        </Card>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {tampil.map((t) => {
            const badge = BADGE[t.status];
            const lanjut = statusBerikutnya(t.status);
            const pesanWa = `Halo ${t.namaPenghuni.split(" ")[0]}, soal tiket ${t.nomor} (${labelKategori(t.kategori).toLowerCase()}) di kamar ${t.nomorKamar}: `;
            return (
              <li key={t.id}>
                <article aria-labelledby={`tiket-${t.id}`} className="flex h-full flex-col gap-3 rounded-2xl border bg-card p-4">
                  <header className="flex items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-xs font-semibold tabular-nums">
                      {t.nomorKamar}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 id={`tiket-${t.id}`} className="truncate font-medium">
                        {labelKategori(t.kategori)}
                      </h2>
                      <p className="truncate text-xs text-muted-foreground">
                        {t.namaPenghuni} · <span className="tabular-nums">{t.nomor}</span>
                      </p>
                    </div>
                    <StatusBadge tone={badge.tone} icon={badge.icon} className="shrink-0">
                      {LABEL_STATUS_TIKET[t.status]}
                    </StatusBadge>
                  </header>
                  <p className="flex-1 text-sm">{t.deskripsi}</p>
                  <p className="text-xs text-muted-foreground">
                    Dilaporkan {formatWaktu(t.dibuatPada)}
                    {t.diperbaruiPada !== t.dibuatPada && ` · diperbarui ${formatWaktu(t.diperbaruiPada)}`}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {lanjut && (
                      <Button size="lg" className="h-10" onClick={() => ubahStatus(t.id, lanjut)}>
                        {AKSI[lanjut as Exclude<StatusTiket, "baru">]}
                      </Button>
                    )}
                    {t.nomorWa && (
                      <Button asChild variant="outline" size="lg" className="h-10">
                        <a href={`https://wa.me/${t.nomorWa}?text=${encodeURIComponent(pesanWa)}`} target="_blank" rel="noopener noreferrer">
                          <MessageCircle data-icon="inline-start" />
                          Hubungi
                        </a>
                      </Button>
                    )}
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
