"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, TriangleAlert } from "lucide-react";

import {
  GalatServer,
  PreviewRows,
  SelesaiState,
  SheetActions,
  SheetBody,
  kirimAksi,
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
  const [langkah, setLangkah] = useState<"isi" | "preview" | "menyimpan" | "selesai">("isi");
  const [tanggal, setTanggal] = useState(hariIni);
  const [alasan, setAlasan] = useState<string>(ALASAN[0]);
  const [galatServer, setGalatServer] = useState<string | null>(null);
  const router = useRouter();

  const penghuni = kamar.penghuni;
  if (!penghuni) return null;
  const { tagihanTerbuka } = penghuni;

  async function konfirmasi() {
    setLangkah("menyimpan");
    setGalatServer(null);
    try {
      await kirimAksi("/api/dashboard/aksi/keluar-penghuni", { roomId: kamar.id, tanggal, alasan });
      setLangkah("selesai");
      router.refresh();
    } catch (err) {
      setGalatServer((err as Error).message);
      setLangkah("preview");
    }
  }

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
      />
    );
  }

  if (langkah === "preview" || langkah === "menyimpan") {
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
          <GalatServer pesan={galatServer} />
        </SheetBody>
        <SheetActions>
          <Button size="lg" variant="outline" disabled={langkah === "menyimpan"} onClick={() => setLangkah("isi")}>
            Ubah
          </Button>
          <Button size="lg" disabled={langkah === "menyimpan"} onClick={konfirmasi}>
            <LogOut data-icon="inline-start" />
            {langkah === "menyimpan" ? "Menyimpan…" : "Konfirmasi keluar"}
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
            max={hariIni}
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
