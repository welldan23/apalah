"use client";

import { useState } from "react";
import { Search, Send } from "lucide-react";

import { ActionSheet } from "@/components/quick-actions/action-sheet";
import { ReminderFlow } from "@/components/quick-actions/reminder-flow";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { HalamanKirimReminder } from "@/lib/data/halaman-reminder";
import type { KandidatReminder } from "@/lib/data/reminder";
import { formatJam, formatPeriode, formatRupiah } from "@/lib/format";
import { keteranganWaktu } from "@/lib/invoice";
import { bolehDiingatkan, JEDA_PENGINGAT_JAM } from "@/lib/reminder";
import { cn } from "@/lib/utils";

type Saringan = "jatuh_tempo" | "belum_jatuh_tempo" | "semua";

const SARINGAN: { nilai: Saringan; label: string; cocok: (k: KandidatReminder) => boolean }[] = [
  { nilai: "jatuh_tempo", label: "Jatuh tempo", cocok: (k) => k.status === "jatuh_tempo" },
  { nilai: "belum_jatuh_tempo", label: "Belum jatuh tempo", cocok: (k) => k.status !== "jatuh_tempo" },
  { nilai: "semua", label: "Semua belum lunas", cocok: () => true },
];

/** "3 jam lalu" / "21 jam lalu" — pengingat terakhir dalam 24 jam. */
function sejak(iso: string, sekarang: Date) {
  const jam = Math.max(1, Math.floor((sekarang.getTime() - new Date(iso).getTime()) / 3_600_000));
  return `${jam} jam lalu (${formatJam(iso)})`;
}

/** Pilih penerima reminder massal: saring, cari, centang — lalu preview & konfirmasi sebelum dikirim. */
export function PilihPenerima({ kandidat, hariIni, periode, sekarang: sekarangIso }: HalamanKirimReminder) {
  const sekarang = new Date(sekarangIso);
  const [saringan, setSaringan] = useState<Saringan>("jatuh_tempo");
  const [cari, setCari] = useState("");
  const [dipilih, setDipilih] = useState(
    () => new Set(kandidat.filter((k) => k.status === "jatuh_tempo" && bolehDiingatkan(k.terakhirDiingatkan, sekarang)).map((k) => k.id)),
  );
  const [preview, setPreview] = useState(false);

  const aturan = SARINGAN.find((s) => s.nilai === saringan)!;
  const kataKunci = cari.trim().toLowerCase();
  const tampil = kandidat
    .filter(aturan.cocok)
    .filter((k) => !kataKunci || k.namaPenghuni.toLowerCase().includes(kataKunci) || k.nomorKamar.toLowerCase().includes(kataKunci));
  const bisaDipilih = tampil.filter((k) => bolehDiingatkan(k.terakhirDiingatkan, sekarang));
  const penerima = kandidat.filter((k) => dipilih.has(k.id));
  const total = penerima.reduce((jumlah, k) => jumlah + k.nominal, 0);
  const semuaTampilDipilih = bisaDipilih.length > 0 && bisaDipilih.every((k) => dipilih.has(k.id));

  function toggle(id: string, cek: boolean) {
    setDipilih((lama) => {
      const baru = new Set(lama);
      if (cek) baru.add(id);
      else baru.delete(id);
      return baru;
    });
  }

  function pilihSemua() {
    setDipilih((lama) => {
      const baru = new Set(lama);
      for (const k of bisaDipilih) {
        if (semuaTampilDipilih) baru.delete(k.id);
        else baru.add(k.id);
      }
      return baru;
    });
  }

  return (
    <>
      <Card className="gap-0 py-0 shadow-none">
        <div className="flex flex-col gap-3 border-b p-4">
          <div role="group" aria-label="Saring tagihan" className="flex flex-wrap gap-1.5">
            {SARINGAN.map(({ nilai, label, cocok }) => {
              const aktif = saringan === nilai;
              return (
                <button
                  key={nilai}
                  type="button"
                  aria-pressed={aktif}
                  onClick={() => setSaringan(nilai)}
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-8",
                    aktif ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                  <span className={cn("rounded-full px-1.5 text-xs tabular-nums", aktif ? "bg-primary-foreground/15" : "bg-card")}>
                    {kandidat.filter(cocok).length}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                aria-label="Cari penghuni atau kamar"
                placeholder="Cari penghuni atau kamar"
                className="h-11 bg-card pl-9 text-base sm:h-10 sm:text-sm"
                value={cari}
                onChange={(e) => setCari(e.target.value)}
              />
            </div>
            <Button variant="ghost" className="h-11 shrink-0 sm:h-10" disabled={bisaDipilih.length === 0} onClick={pilihSemua}>
              {semuaTampilDipilih ? "Kosongkan" : "Pilih semua"}
            </Button>
          </div>
        </div>

        {tampil.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">Tidak ada tagihan yang cocok.</p>
        ) : (
          <ul className="divide-y">
            {tampil.map((k) => {
              const boleh = bolehDiingatkan(k.terakhirDiingatkan, sekarang);
              const waktu = keteranganWaktu(k, hariIni);
              const id = `penerima-${k.id}`;
              return (
                <li key={k.id}>
                  <label
                    htmlFor={id}
                    className={cn("flex items-center gap-3 px-4 py-3", boleh ? "cursor-pointer hover:bg-muted/60" : "cursor-not-allowed opacity-60")}
                  >
                    <Checkbox id={id} checked={boleh && dipilih.has(k.id)} disabled={!boleh} onCheckedChange={(cek) => toggle(k.id, cek === true)} />
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-xs font-semibold tabular-nums">
                      {k.nomorKamar}
                    </span>
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="block truncate font-medium">{k.namaPenghuni}</span>
                      <span className="block text-xs text-muted-foreground">
                        <span className={waktu.telat ? "text-danger" : undefined}>{waktu.teks}</span>
                        {k.periode !== periode && ` · ${formatPeriode(k.periode)}`}
                      </span>
                      {k.terakhirDiingatkan && (
                        <span className={cn("block text-xs", boleh ? "text-muted-foreground" : "text-warning")}>
                          {boleh
                            ? `Terakhir diingatkan ${new Date(k.terakhirDiingatkan).toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" })}`
                            : `Sudah diingatkan ${sejak(k.terakhirDiingatkan, sekarang)}`}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-sm font-medium tabular-nums">{formatRupiah(k.nominal)}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        <p className="border-t px-4 py-3 text-xs text-muted-foreground">
          Penyewa yang sudah diingatkan dalam {JEDA_PENGINGAT_JAM} jam terakhir tidak bisa dipilih, supaya tidak terkesan spam.
        </p>
      </Card>

      <div className="sticky bottom-20 z-10 flex items-center gap-3 rounded-xl border bg-card p-3 shadow-sm lg:bottom-4">
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-medium">{penerima.length} penerima</p>
          <p className="text-xs text-muted-foreground tabular-nums">Total {formatRupiah(total)}</p>
        </div>
        <Button size="lg" className="h-11" disabled={penerima.length === 0} aria-haspopup="dialog" onClick={() => setPreview(true)}>
          <Send data-icon="inline-start" />
          Lanjut ke preview
        </Button>
      </div>

      <ActionSheet
        open={preview}
        onOpenChange={setPreview}
        title="Preview reminder"
        description="Cek penerima, periode, dan nominal dulu. Pesan baru terkirim setelah kamu konfirmasi."
      >
        {preview && <ReminderFlow periode={periode} hariIni={hariIni} tagihan={penerima} />}
      </ActionSheet>
    </>
  );
}
