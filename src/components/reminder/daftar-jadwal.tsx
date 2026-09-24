"use client";

import { useState } from "react";
import { Check, Pencil, Plus, Save } from "lucide-react";

import { ActionSheet, CatatanSimulasi } from "@/components/quick-actions/action-sheet";
import { FormJadwal } from "@/components/reminder/form-jadwal";
import { Saklar } from "@/components/saklar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { HalamanJadwalPengingat } from "@/lib/data/halaman-reminder";
import { keteranganJadwal, labelJadwal, MAKS_JADWAL, type JadwalPengingat } from "@/lib/reminder";
import { cn } from "@/lib/utils";

type Pengaturan = { otomatisAktif: boolean; jadwal: JadwalPengingat[] };

const urutkan = (jadwal: JadwalPengingat[]) => [...jadwal].sort((a, b) => a.offsetHari - b.offsetHari);

/** Daftar jadwal pengingat: saklar utama + saklar per jadwal, dengan jumlah pengingat minggu ini. */
export function DaftarJadwal({ otomatisAktif, jadwal, antrian }: HalamanJadwalPengingat) {
  const [pengaturan, setPengaturan] = useState<Pengaturan>({ otomatisAktif, jadwal: urutkan(jadwal) });
  const [tersimpan, setTersimpan] = useState<Pengaturan>({ otomatisAktif, jadwal: urutkan(jadwal) });
  const [baruDisimpan, setBaruDisimpan] = useState(false);
  /** null = tertutup; indeks undefined = tambah baru. */
  const [form, setForm] = useState<{ indeks?: number } | null>(null);
  const berubah = JSON.stringify(pengaturan) !== JSON.stringify(tersimpan);

  const urut = pengaturan.jadwal;
  const mingguIni = (offset: number) =>
    antrian.filter((a) => a.jenis === labelJadwal(offset)).reduce((jumlah, a) => jumlah + a.jumlah, 0);
  const jumlahAktif = pengaturan.jadwal.filter((j) => j.aktif).length;

  function ubah(perubahan: Partial<Pengaturan>) {
    setBaruDisimpan(false);
    setPengaturan((p) => ({ ...p, ...perubahan }));
  }

  const ubahJadwal = (offset: number, aktif: boolean) =>
    ubah({ jadwal: pengaturan.jadwal.map((j) => (j.offsetHari === offset ? { ...j, aktif } : j)) });

  function simpanForm(baru: JadwalPengingat) {
    const indeks = form?.indeks;
    const daftar = indeks === undefined ? [...pengaturan.jadwal, baru] : pengaturan.jadwal.map((j, i) => (i === indeks ? baru : j));
    ubah({ jadwal: urutkan(daftar) });
    setForm(null);
  }

  function hapus(indeks: number) {
    ubah({ jadwal: pengaturan.jadwal.filter((_, i) => i !== indeks) });
    setForm(null);
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="shadow-none">
        <CardContent className="flex items-center justify-between gap-4">
          <div>
            <p id="otomatis-label" className="font-medium">
              Kirim pengingat otomatis
            </p>
            <p className="text-sm text-muted-foreground">
              {pengaturan.otomatisAktif
                ? `${jumlahAktif} jadwal aktif — hanya ke penyewa yang belum bayar.`
                : "Nonaktif — pengingat hanya dikirim manual."}
            </p>
          </div>
          <Saklar nyala={pengaturan.otomatisAktif} onUbah={(nyala) => ubah({ otomatisAktif: nyala })} labelledBy="otomatis-label" />
        </CardContent>
      </Card>

      <Card className="gap-0 py-0 shadow-none">
        <ul aria-label="Jadwal pengingat" className="divide-y">
          {urut.map((j, indeks) => {
            const id = `jadwal-${j.offsetHari}`;
            const aktif = pengaturan.otomatisAktif && j.aktif;
            const jumlah = mingguIni(j.offsetHari);
            return (
              <li key={j.offsetHari} className={cn("flex items-center gap-3 px-4 py-3.5", !pengaturan.otomatisAktif && "opacity-60")}>
                <span
                  className={cn(
                    "grid h-9 min-w-13 place-items-center rounded-lg px-2 text-sm font-semibold",
                    aktif ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  {labelJadwal(j.offsetHari)}
                </span>
                <div className="min-w-0 flex-1">
                  <p id={id} className="font-medium">
                    {keteranganJadwal(j.offsetHari)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Pukul {j.jam.replace(":", ".")} WIB
                    {aktif && ` · ${jumlah ? `${jumlah} pengingat minggu ini` : "belum ada minggu ini"}`}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-10 shrink-0"
                  aria-label={`Ubah jadwal ${labelJadwal(j.offsetHari)}`}
                  aria-haspopup="dialog"
                  onClick={() => setForm({ indeks })}
                >
                  <Pencil />
                </Button>
                <Saklar
                  nyala={j.aktif}
                  onUbah={(nyala) => ubahJadwal(j.offsetHari, nyala)}
                  labelledBy={id}
                  disabled={!pengaturan.otomatisAktif}
                />
              </li>
            );
          })}
          {urut.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-muted-foreground">Belum ada jadwal. Tambahkan minimal satu.</li>
          )}
        </ul>
        <div className="border-t p-3">
          <Button
            variant="outline"
            className="h-11 w-full bg-card sm:w-auto"
            aria-haspopup="dialog"
            disabled={urut.length >= MAKS_JADWAL}
            onClick={() => setForm({})}
          >
            <Plus data-icon="inline-start" />
            {urut.length >= MAKS_JADWAL ? `Maksimal ${MAKS_JADWAL} jadwal` : "Tambah jadwal"}
          </Button>
        </div>
      </Card>

      <ActionSheet
        open={form !== null}
        onOpenChange={(buka) => !buka && setForm(null)}
        title={form?.indeks === undefined ? "Tambah jadwal" : "Ubah jadwal"}
        description="Kapan pengingat dikirim, relatif terhadap tanggal jatuh tempo penyewa."
      >
        {form && (
          <FormJadwal
            key={form.indeks ?? "baru"}
            awal={form.indeks === undefined ? undefined : pengaturan.jadwal[form.indeks]}
            semua={pengaturan.jadwal}
            indeksUbah={form.indeks}
            onSimpan={simpanForm}
            onHapus={form.indeks === undefined ? undefined : () => hapus(form.indeks!)}
          />
        )}
      </ActionSheet>

      <p className="text-xs text-muted-foreground">
        Setiap pengingat berisi nominal, jatuh tempo, dan link invoice. Tagihan yang sudah lunas tidak
        diingatkan, dan satu penyewa tidak diingatkan lebih dari sekali sehari.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        {baruDisimpan && !berubah && (
          <p role="status" className="flex items-center gap-1.5 text-sm text-success">
            <Check className="size-4" aria-hidden="true" />
            Jadwal tersimpan.
          </p>
        )}
        {baruDisimpan && !berubah && <CatatanSimulasi>Mode contoh: jadwal belum benar-benar disimpan ke server.</CatatanSimulasi>}
        <Button
          size="lg"
          className="h-11"
          disabled={!berubah}
          onClick={() => {
            setTersimpan(pengaturan);
            setBaruDisimpan(true);
          }}
        >
          <Save data-icon="inline-start" />
          Simpan jadwal
        </Button>
      </div>
    </div>
  );
}
