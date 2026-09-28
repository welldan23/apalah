"use client";

import { useState } from "react";
import { CalendarClock, Check, Save } from "lucide-react";

import { GalatServer, kirimAksi } from "@/components/quick-actions/action-sheet";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import type { HalamanTagihanTerjadwal } from "@/lib/data/tagihan-terjadwal";
import { formatHari, formatPeriode, formatRupiah } from "@/lib/format";
import {
  peringatanJadwal,
  ringkasJadwal,
  terbitBerikutnya,
  type PengaturanTagihanTerjadwal,
} from "@/lib/tagihan-terjadwal";
import { cn } from "@/lib/utils";

const PILIHAN_TANGGAL = Array.from({ length: 28 }, (_, i) => i + 1);

const kelasSelect =
  "h-11 w-full rounded-lg border border-input bg-card px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 sm:h-10 sm:text-sm";

/** Form pengaturan tagihan terjadwal bulanan + ringkasan penerbitan berikutnya. */
export function FormTagihanTerjadwal({
  hariIni,
  pengaturan: awal,
  jumlahKamar,
  totalSewa,
}: HalamanTagihanTerjadwal) {
  const [pengaturan, setPengaturan] = useState<PengaturanTagihanTerjadwal>(awal);
  const [tersimpan, setTersimpan] = useState<PengaturanTagihanTerjadwal>(awal);
  const [baruDisimpan, setBaruDisimpan] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);
  const [galatServer, setGalatServer] = useState<string | null>(null);

  const berubah = JSON.stringify(pengaturan) !== JSON.stringify(tersimpan);
  const berikutnya = terbitBerikutnya(pengaturan.tanggalTerbit, hariIni);
  const peringatan = pengaturan.aktif ? peringatanJadwal(pengaturan) : [];

  function ubah(perubahan: Partial<PengaturanTagihanTerjadwal>) {
    setBaruDisimpan(false);
    setPengaturan((p) => ({ ...p, ...perubahan }));
  }

  async function simpan() {
    setMenyimpan(true);
    setGalatServer(null);
    try {
      const hasil = await kirimAksi<PengaturanTagihanTerjadwal>(
        "/api/dashboard/tagihan-terjadwal",
        pengaturan,
        "PUT",
      );
      setPengaturan(hasil);
      setTersimpan(hasil);
      setBaruDisimpan(true);
    } catch (err) {
      setGalatServer((err as Error).message);
    } finally {
      setMenyimpan(false);
    }
  }

  return (
    <>
      <Card className="shadow-none">
        <CardContent className="flex items-center justify-between gap-4">
          <div>
            <p id="terjadwal-aktif-label" className="font-medium">
              Terbitkan tagihan otomatis
            </p>
            <p className="text-sm text-muted-foreground">
              {pengaturan.aktif
                ? ringkasJadwal(pengaturan)
                : "Nonaktif — tagihan hanya dibuat manual."}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={pengaturan.aktif}
            aria-labelledby="terjadwal-aktif-label"
            onClick={() => ubah({ aktif: !pengaturan.aktif })}
            className={cn(
              "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 after:absolute after:-inset-2",
              pengaturan.aktif ? "bg-primary" : "bg-muted-foreground/30",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "size-5 rounded-full bg-card shadow-xs transition-transform",
                pengaturan.aktif ? "translate-x-6" : "translate-x-1",
              )}
            />
          </button>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>Jadwal</CardTitle>
          <CardDescription>Berlaku untuk semua kamar terisi, termasuk penghuni baru.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="terjadwal-terbit">Tanggal terbit tiap bulan</Label>
            <select
              id="terjadwal-terbit"
              className={kelasSelect}
              value={pengaturan.tanggalTerbit}
              disabled={!pengaturan.aktif}
              onChange={(e) => ubah({ tanggalTerbit: Number(e.target.value) })}
            >
              {PILIHAN_TANGGAL.map((t) => (
                <option key={t} value={t}>
                  Tanggal {t}
                </option>
              ))}
            </select>
          </div>

          <fieldset className="flex flex-col gap-2" disabled={!pengaturan.aktif}>
            <legend className="mb-1.5 text-sm font-medium">Jatuh tempo</legend>
            {(
              [
                ["tanggal_masuk", "Ikut tanggal masuk penghuni", "Masuk tanggal 15 → jatuh tempo tiap tanggal 15."],
                ["tanggal_tetap", "Tanggal tetap untuk semua penghuni", "Semua penghuni jatuh tempo di tanggal yang sama."],
              ] as const
            ).map(([nilai, label, keterangan]) => (
              <label
                key={nilai}
                className={cn(
                  "flex cursor-pointer items-start gap-2.5 rounded-lg border bg-card px-3 py-2.5 text-sm has-disabled:cursor-not-allowed has-disabled:opacity-60",
                  pengaturan.jatuhTempo.aturan === nilai && "border-primary/50 bg-accent/40",
                )}
              >
                <input
                  type="radio"
                  name="aturan-jatuh-tempo"
                  value={nilai}
                  checked={pengaturan.jatuhTempo.aturan === nilai}
                  onChange={() =>
                    ubah({
                      jatuhTempo:
                        nilai === "tanggal_masuk"
                          ? { aturan: "tanggal_masuk" }
                          : { aturan: "tanggal_tetap", tanggal: 10 },
                    })
                  }
                  className="mt-0.5 size-4 accent-primary"
                />
                <span>
                  <span className="block font-medium">{label}</span>
                  <span className="block text-xs text-muted-foreground">{keterangan}</span>
                </span>
              </label>
            ))}
            {pengaturan.jatuhTempo.aturan === "tanggal_tetap" && (
              <select
                aria-label="Tanggal jatuh tempo"
                className={kelasSelect}
                value={pengaturan.jatuhTempo.tanggal}
                onChange={(e) =>
                  ubah({ jatuhTempo: { aturan: "tanggal_tetap", tanggal: Number(e.target.value) } })
                }
              >
                {PILIHAN_TANGGAL.map((t) => (
                  <option key={t} value={t}>
                    Jatuh tempo tanggal {t}
                  </option>
                ))}
              </select>
            )}
          </fieldset>

          <div className="rounded-lg bg-muted px-3 py-2.5 text-sm">
            <p className="font-medium">Nominal</p>
            <p className="text-muted-foreground">
              Sesuai harga sewa masing-masing penghuni. Ubah harga sewa lewat data penghuni.
            </p>
          </div>
        </CardContent>
      </Card>

      {pengaturan.aktif && (
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="size-4 text-primary" aria-hidden="true" />
              Penerbitan berikutnya
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <dl className="divide-y rounded-lg border bg-card text-sm">
              {(
                [
                  ["Terbit", formatHari(berikutnya.tanggal)],
                  ["Periode", formatPeriode(berikutnya.periode)],
                  ["Penerima", `${jumlahKamar} penyewa`],
                  ["Perkiraan total", formatRupiah(totalSewa)],
                ] as const
              ).map(([label, nilai]) => (
                <div key={label} className="flex items-start justify-between gap-4 px-3 py-2.5">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="text-right font-medium tabular-nums">{nilai}</dd>
                </div>
              ))}
            </dl>
            {peringatan.map((pesan) => (
              <p key={pesan} role="status" className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
                {pesan}
              </p>
            ))}
            <p className="text-xs text-muted-foreground">
              Kamar yang sudah punya tagihan di periode itu dilewati, jadi tidak ada tagihan ganda.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <GalatServer pesan={galatServer} />
        {baruDisimpan && !berubah && (
          <p role="status" className="flex items-center gap-1.5 text-sm text-success">
            <Check className="size-4" aria-hidden="true" />
            Pengaturan tersimpan.
          </p>
        )}
        <Button size="lg" className="h-11" disabled={!berubah || menyimpan} onClick={simpan}>
          <Save data-icon="inline-start" />
          {menyimpan ? "Menyimpan…" : "Simpan pengaturan"}
        </Button>
      </div>
    </>
  );
}
