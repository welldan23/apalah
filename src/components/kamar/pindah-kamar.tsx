"use client";

import { useState } from "react";
import { ArrowRight, ArrowRightLeft } from "lucide-react";

import {
  CatatanSimulasi,
  FieldError,
  PreviewRows,
  SelesaiState,
  SheetActions,
  SheetBody,
} from "@/components/quick-actions/action-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SheetClose } from "@/components/ui/sheet";
import type { KamarPenghuni } from "@/lib/data/kamar";
import { formatRupiah, formatRupiahSingkat, formatTanggal } from "@/lib/format";
import { kamarTujuan } from "@/lib/pindah-kamar";
import { cn } from "@/lib/utils";

type Langkah = "isi" | "preview" | "selesai";
type Sewa = "tetap" | "ikut_kamar";

/** Pindah kamar: pilih kamar kosong tujuan, tanggal & sewa → preview → konfirmasi. */
export function PindahKamarFlow({
  asal,
  semuaKamar,
  hariIni,
}: {
  /** Kamar terisi yang penghuninya dipindah. */
  asal: KamarPenghuni;
  semuaKamar: KamarPenghuni[];
  hariIni: string;
}) {
  const pilihan = kamarTujuan(semuaKamar, asal);
  const [langkah, setLangkah] = useState<Langkah>("isi");
  const [tujuanId, setTujuanId] = useState(pilihan[0]?.id ?? "");
  const [tanggal, setTanggal] = useState(hariIni);
  const [sewa, setSewa] = useState<Sewa>("tetap");
  const [galat, setGalat] = useState("");

  const penghuni = asal.penghuni;
  const tujuan = pilihan.find((k) => k.id === tujuanId);
  const sewaLama = penghuni?.hargaSewa ?? asal.hargaSewa;
  const sewaBaru = sewa === "tetap" ? sewaLama : (tujuan?.hargaSewa ?? sewaLama);

  if (!penghuni) return null;

  if (pilihan.length === 0) {
    return (
      <>
        <SheetBody className="items-center justify-center py-10 text-center">
          <p className="font-medium">Tidak ada kamar kosong</p>
          <p className="text-sm text-muted-foreground">Kosongkan atau tambah kamar dulu sebelum memindahkan penghuni.</p>
        </SheetBody>
        <SheetActions>
          <SheetClose asChild>
            <Button size="lg" variant="outline">
              Tutup
            </Button>
          </SheetClose>
        </SheetActions>
      </>
    );
  }

  if (langkah === "selesai") {
    return (
      <SelesaiState
        judul={`${penghuni.nama} pindah ke kamar ${tujuan?.nomorKamar}`}
        pesan={`Kamar ${asal.nomorKamar} kini kosong. Tagihan berikutnya memakai kamar dan sewa baru.`}
        catatan="Mode contoh: perpindahan belum benar-benar disimpan ke server."
      />
    );
  }

  if (langkah === "preview" && tujuan) {
    return (
      <>
        <SheetBody>
          <p className="flex items-center justify-center gap-3 rounded-lg bg-muted py-3 text-lg font-semibold tabular-nums">
            {asal.nomorKamar}
            <ArrowRight className="size-5 text-primary" aria-label="pindah ke" />
            {tujuan.nomorKamar}
          </p>
          <PreviewRows
            rows={[
              ["Penghuni", penghuni.nama],
              ["Dari", `${asal.nomorKamar} · ${asal.tipe}`],
              ["Ke", `${tujuan.nomorKamar} · ${tujuan.tipe}`],
              ["Tanggal pindah", formatTanggal(tanggal)],
              [
                "Sewa/bulan",
                sewaBaru === sewaLama
                  ? `${formatRupiah(sewaBaru)} (tetap)`
                  : `${formatRupiah(sewaLama)} → ${formatRupiah(sewaBaru)}`,
              ],
            ]}
          />
          <p className="text-xs text-muted-foreground">
            Tagihan yang sudah terbit tidak berubah. Kamar {asal.nomorKamar} jadi kosong dan siap
            ditawarkan.
          </p>
          <CatatanSimulasi>Mode contoh: belum tersimpan ke server.</CatatanSimulasi>
        </SheetBody>
        <SheetActions>
          <Button size="lg" variant="outline" onClick={() => setLangkah("isi")}>
            Ubah
          </Button>
          <Button size="lg" onClick={() => setLangkah("selesai")}>
            <ArrowRightLeft data-icon="inline-start" />
            Konfirmasi pindah
          </Button>
        </SheetActions>
      </>
    );
  }

  return (
    <>
      <SheetBody>
        <p className="rounded-lg bg-muted px-3 py-2.5 text-sm">
          <span className="font-medium">{penghuni.nama}</span>
          <span className="text-muted-foreground">
            {" "}
            · kamar {asal.nomorKamar} ({asal.tipe}) · {formatRupiah(sewaLama)}/bln
          </span>
        </p>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium">Pindah ke kamar</legend>
          <div role="radiogroup" aria-label="Kamar tujuan" className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {pilihan.map((k) => {
              const aktif = k.id === tujuanId;
              return (
                <button
                  key={k.id}
                  type="button"
                  role="radio"
                  aria-checked={aktif}
                  onClick={() => {
                    setGalat("");
                    setTujuanId(k.id);
                  }}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center rounded-lg border bg-card px-2 py-2 text-center outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    aktif ? "border-primary bg-accent/60" : "hover:bg-muted",
                  )}
                >
                  <span className="font-semibold tabular-nums">{k.nomorKamar}</span>
                  <span className="text-[0.7rem] text-muted-foreground">
                    {k.tipe} · {formatRupiahSingkat(k.hargaSewa)}
                  </span>
                </button>
              );
            })}
          </div>
          <FieldError id="pindah-galat" pesan={galat || undefined} />
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pindah-tanggal">Tanggal pindah</Label>
          <Input
            id="pindah-tanggal"
            type="date"
            className="h-10 bg-card"
            value={tanggal}
            onChange={(e) => setTanggal(e.target.value)}
          />
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium">Sewa setelah pindah</legend>
          {(
            [
              ["tetap", `Tetap ${formatRupiah(sewaLama)}`],
              ["ikut_kamar", `Ikut harga kamar tujuan (${tujuan ? formatRupiah(tujuan.hargaSewa) : "—"})`],
            ] as const
          ).map(([nilai, label]) => (
            <label
              key={nilai}
              className={cn(
                "flex cursor-pointer items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5 text-sm",
                sewa === nilai && "border-primary/50 bg-accent/40",
              )}
            >
              <input
                type="radio"
                name="sewa-pindah"
                value={nilai}
                checked={sewa === nilai}
                onChange={() => setSewa(nilai)}
                className="size-4 accent-primary"
              />
              {label}
            </label>
          ))}
        </fieldset>
      </SheetBody>

      <SheetActions>
        <SheetClose asChild>
          <Button size="lg" variant="outline">
            Batal
          </Button>
        </SheetClose>
        <Button
          size="lg"
          onClick={() => {
            if (!tujuan) return setGalat("Pilih kamar tujuan.");
            if (!tanggal) return setGalat("Isi tanggal pindah.");
            setLangkah("preview");
          }}
        >
          Lihat preview
        </Button>
      </SheetActions>
    </>
  );
}
