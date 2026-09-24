"use client";

import { useState } from "react";
import { LogOut, TriangleAlert } from "lucide-react";

import {
  CatatanSimulasi,
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
import { formatRupiah, formatTanggal } from "@/lib/format";
import { lamaTinggal } from "@/lib/penghuni";

const ALASAN = ["Selesai kontrak", "Pindah ke luar kota", "Pindah kos lain", "Lainnya"] as const;

/** Keluar penghuni: tanggal & alasan → preview (dengan peringatan tagihan belum lunas) → konfirmasi. */
export function KeluarPenghuniFlow({ kamar, hariIni }: { kamar: KamarPenghuni; hariIni: string }) {
  const [langkah, setLangkah] = useState<"isi" | "preview" | "selesai">("isi");
  const [tanggal, setTanggal] = useState(hariIni);
  const [alasan, setAlasan] = useState<string>(ALASAN[0]);

  const penghuni = kamar.penghuni;
  if (!penghuni) return null;
  const { tagihanTerbuka } = penghuni;

  const peringatanTagihan = tagihanTerbuka.jumlah > 0 && (
    <p role="status" className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2.5 text-sm text-warning">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      Masih ada {tagihanTerbuka.jumlah} tagihan belum lunas ({formatRupiah(tagihanTerbuka.nominal)}). Tagihan
      tetap tercatat dan bisa ditagih setelah penghuni keluar.
    </p>
  );

  if (langkah === "selesai") {
    return (
      <SelesaiState
        judul={`${penghuni.nama} keluar dari kamar ${kamar.nomorKamar}`}
        pesan="Kamar kini kosong dan penghuni dipindah ke daftar nonaktif. Tagihan bulanan untuknya berhenti terbit."
        catatan="Mode contoh: belum benar-benar disimpan ke server."
      />
    );
  }

  if (langkah === "preview") {
    return (
      <>
        <SheetBody>
          <PreviewRows
            rows={[
              ["Penghuni", penghuni.nama],
              ["Kamar", `${kamar.nomorKamar} · ${kamar.tipe}`],
              ["Tanggal keluar", formatTanggal(tanggal)],
              ["Lama tinggal", lamaTinggal(penghuni.tanggalMasuk, tanggal)],
              ["Alasan", alasan],
            ]}
          />
          {peringatanTagihan}
          <p className="text-xs text-muted-foreground">
            Kamar {kamar.nomorKamar} jadi kosong dan siap ditawarkan. Data penghuni tetap tersimpan
            di daftar nonaktif.
          </p>
          <CatatanSimulasi>Mode contoh: belum tersimpan ke server.</CatatanSimulasi>
        </SheetBody>
        <SheetActions>
          <Button size="lg" variant="outline" onClick={() => setLangkah("isi")}>
            Ubah
          </Button>
          <Button size="lg" onClick={() => setLangkah("selesai")}>
            <LogOut data-icon="inline-start" />
            Konfirmasi keluar
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
            · kamar {kamar.nomorKamar} · masuk {formatTanggal(penghuni.tanggalMasuk)}
          </span>
        </p>
        {peringatanTagihan}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="keluar-tanggal">Tanggal keluar</Label>
          <Input
            id="keluar-tanggal"
            type="date"
            min={penghuni.tanggalMasuk}
            className="h-10 bg-card"
            value={tanggal}
            onChange={(e) => setTanggal(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="keluar-alasan">Alasan (opsional)</Label>
          <select
            id="keluar-alasan"
            className="h-10 w-full rounded-lg border border-input bg-card px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
            value={alasan}
            onChange={(e) => setAlasan(e.target.value)}
          >
            {ALASAN.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </div>
      </SheetBody>
      <SheetActions>
        <SheetClose asChild>
          <Button size="lg" variant="outline">
            Batal
          </Button>
        </SheetClose>
        <Button size="lg" disabled={!tanggal} onClick={() => setLangkah("preview")}>
          Lihat preview
        </Button>
      </SheetActions>
    </>
  );
}
