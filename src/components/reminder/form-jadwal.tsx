"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

import { FieldError, SheetActions, SheetBody } from "@/components/quick-actions/action-sheet";
import { Saklar } from "@/components/saklar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SheetClose } from "@/components/ui/sheet";
import { keteranganJadwal, labelJadwal, MAKS_OFFSET_HARI, periksaJadwal, type JadwalPengingat } from "@/lib/reminder";
import { cn } from "@/lib/utils";

type Arah = "sebelum" | "hari_h" | "setelah";

const ARAH: { nilai: Arah; label: string }[] = [
  { nilai: "sebelum", label: "Sebelum" },
  { nilai: "hari_h", label: "Hari H" },
  { nilai: "setelah", label: "Setelah" },
];

/** Form tambah/ubah satu jadwal pengingat: kapan (relatif jatuh tempo), jam kirim, aktif. */
export function FormJadwal({
  awal,
  semua,
  indeksUbah,
  onSimpan,
  onHapus,
}: {
  awal?: JadwalPengingat;
  semua: JadwalPengingat[];
  indeksUbah?: number;
  onSimpan: (jadwal: JadwalPengingat) => void;
  onHapus?: () => void;
}) {
  const [arah, setArah] = useState<Arah>(!awal ? "sebelum" : awal.offsetHari < 0 ? "sebelum" : awal.offsetHari > 0 ? "setelah" : "hari_h");
  const [hari, setHari] = useState(awal ? Math.abs(awal.offsetHari) || 1 : 1);
  const [jam, setJam] = useState(awal?.jam ?? "09:00");
  const [aktif, setAktif] = useState(awal?.aktif ?? true);
  const [galat, setGalat] = useState("");

  const offsetHari = arah === "hari_h" ? 0 : arah === "sebelum" ? -hari : hari;
  const jadwal: JadwalPengingat = { offsetHari, jam, aktif };

  function simpan() {
    const pesan = periksaJadwal(jadwal, semua, indeksUbah);
    setGalat(pesan);
    if (!pesan) onSimpan(jadwal);
  }

  return (
    <>
      <SheetBody>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium">Kapan dikirim</legend>
          <div role="radiogroup" aria-label="Kapan dikirim" className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
            {ARAH.map(({ nilai, label }) => (
              <button
                key={nilai}
                type="button"
                role="radio"
                aria-checked={arah === nilai}
                onClick={() => {
                  setGalat("");
                  setArah(nilai);
                }}
                className={cn(
                  "h-10 rounded-md text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  arah === nilai ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="jadwal-hari">Jumlah hari</Label>
            <Input
              id="jadwal-hari"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAKS_OFFSET_HARI}
              className="h-10 bg-card"
              disabled={arah === "hari_h"}
              value={arah === "hari_h" ? 0 : hari}
              onChange={(e) => {
                setGalat("");
                setHari(Math.max(1, Math.min(MAKS_OFFSET_HARI, Math.trunc(Number(e.target.value)) || 1)));
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="jadwal-jam">Jam kirim (WIB)</Label>
            <Input
              id="jadwal-jam"
              type="time"
              step={900}
              min="06:00"
              max="21:00"
              className="h-10 bg-card"
              value={jam}
              onChange={(e) => {
                setGalat("");
                setJam(e.target.value);
              }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-lg border bg-card px-3 py-2.5">
          <p id="jadwal-aktif" className="text-sm font-medium">
            Aktif
          </p>
          <Saklar nyala={aktif} onUbah={setAktif} labelledBy="jadwal-aktif" />
        </div>

        <p className="rounded-lg bg-muted px-3 py-2.5 text-sm">
          <span className="font-semibold">{labelJadwal(offsetHari)}</span>
          <span className="text-muted-foreground">
            {" "}
            · {keteranganJadwal(offsetHari)}, pukul {jam ? jam.replace(":", ".") : "—"} WIB
          </span>
        </p>
        <FieldError id="jadwal-galat" pesan={galat || undefined} />

        {onHapus && (
          <Button variant="ghost" className="h-11 self-start text-danger hover:text-danger" onClick={onHapus}>
            <Trash2 data-icon="inline-start" />
            Hapus jadwal ini
          </Button>
        )}
      </SheetBody>
      <SheetActions>
        <SheetClose asChild>
          <Button size="lg" variant="outline">
            Batal
          </Button>
        </SheetClose>
        <Button size="lg" onClick={simpan}>
          {awal ? "Simpan perubahan" : "Tambah jadwal"}
        </Button>
      </SheetActions>
    </>
  );
}
