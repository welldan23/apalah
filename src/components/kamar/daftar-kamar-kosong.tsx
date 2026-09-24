"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Ban, RotateCcw, UserPlus } from "lucide-react";

import { SheetTambahPenghuni } from "@/components/kamar/tambah-penghuni";
import {
  ActionSheet,
  GalatServer,
  SheetActions,
  SheetBody,
  kirimAksi,
} from "@/components/quick-actions/action-sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SheetClose } from "@/components/ui/sheet";
import type { KamarKosong, KamarNonaktif } from "@/lib/data/kamar";
import { formatRupiah, formatRupiahSingkat, formatTanggal } from "@/lib/format";
import { hariKosong, parseUrutKosong, PILIHAN_URUT_KOSONG, saringKamarKosong } from "@/lib/kamar-kosong";
import { cn } from "@/lib/utils";

/** Kosong selama ini (hari) atau lebih ditandai supaya segera ditawarkan. */
const KOSONG_LAMA = 30;

function KartuKamarKosong({
  kamar: k,
  hariIni,
  onIsi,
  onNonaktifkan,
}: {
  kamar: KamarKosong;
  hariIni: string;
  onIsi: () => void;
  onNonaktifkan: () => void;
}) {
  const hari = hariKosong(k.kosongSejak, hariIni);

  return (
    <article
      aria-label={`Kamar ${k.nomorKamar}, ${k.tipe}`}
      className="flex h-full items-center gap-3 rounded-xl border border-dashed border-warning/60 bg-warning-soft/40 p-3 sm:flex-col sm:items-stretch"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-lg font-semibold tabular-nums">{k.nomorKamar}</span>
          <span className="text-sm">
            <span className="font-medium tabular-nums">{formatRupiahSingkat(k.hargaSewa)}</span>
            <span className="text-muted-foreground">/bln</span>
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{k.tipe}</p>
        {hari === undefined ? (
          <p className="mt-1.5 text-xs text-muted-foreground">Belum ada riwayat penghuni</p>
        ) : (
          <>
            <p className={cn("mt-1.5 text-sm font-medium", hari >= KOSONG_LAMA && "text-warning")}>
              {hari === 0 ? "Kosong sejak hari ini" : `Kosong ${hari} hari`}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {k.penghuniTerakhir}{" "}
              {k.alasanTerakhir?.startsWith("pindah")
                ? `${k.alasanTerakhir} pada ${formatTanggal(k.kosongSejak!)}`
                : `keluar ${formatTanggal(k.kosongSejak!)}`}
            </p>
          </>
        )}
        {k.catatan && <p className="mt-1 text-xs text-muted-foreground italic">{k.catatan}</p>}
      </div>
      <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
        <Button
          variant="outline"
          size="sm"
          className="h-11 bg-card sm:h-9 sm:flex-1"
          aria-haspopup="dialog"
          aria-label={`Isi kamar ${k.nomorKamar}`}
          onClick={onIsi}
        >
          <UserPlus data-icon="inline-start" />
          Isi kamar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 text-muted-foreground"
          aria-haspopup="dialog"
          aria-label={`Nonaktifkan kamar ${k.nomorKamar}`}
          onClick={onNonaktifkan}
        >
          <Ban data-icon="inline-start" />
          Nonaktifkan
        </Button>
      </div>
    </article>
  );
}

/** Konfirmasi nonaktifkan kamar kosong (mis. renovasi) — kamar tidak dihitung & tidak bisa diisi. */
function NonaktifkanKamarFlow({ kamar, onSelesai }: { kamar: KamarKosong; onSelesai: () => void }) {
  const router = useRouter();
  const [catatan, setCatatan] = useState("");
  const [menyimpan, setMenyimpan] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  async function simpan() {
    setMenyimpan(true);
    setGalat(null);
    try {
      await kirimAksi(`/api/dashboard/kamar/${kamar.id}`, { aktif: false, ...(catatan.trim() ? { catatan } : {}) }, "PATCH");
      router.refresh();
      onSelesai();
    } catch (err) {
      setGalat((err as Error).message);
      setMenyimpan(false);
    }
  }

  return (
    <>
      <SheetBody>
        <p className="text-sm">
          Kamar <span className="font-semibold">{kamar.nomorKamar}</span> ({kamar.tipe}) tidak lagi dihitung di
          ringkasan, tidak ditawarkan, dan tidak bisa diisi penghuni sampai diaktifkan lagi. Riwayatnya tetap
          tersimpan.
        </p>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nonaktif-catatan">Alasan (opsional)</Label>
          <Input
            id="nonaktif-catatan"
            className="h-10 bg-card"
            placeholder="Mis. Renovasi kamar mandi"
            maxLength={200}
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
          />
        </div>
        <GalatServer pesan={galat} />
      </SheetBody>
      <SheetActions>
        <SheetClose asChild>
          <Button size="lg" variant="outline" disabled={menyimpan}>
            Batal
          </Button>
        </SheetClose>
        <Button size="lg" disabled={menyimpan} onClick={simpan}>
          <Ban data-icon="inline-start" />
          {menyimpan ? "Menyimpan…" : "Nonaktifkan"}
        </Button>
      </SheetActions>
    </>
  );
}

/** Kamar yang dinonaktifkan, bisa diaktifkan lagi. */
export function DaftarKamarNonaktif({ kamar }: { kamar: KamarNonaktif[] }) {
  const router = useRouter();
  const [memproses, setMemproses] = useState<string | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  if (kamar.length === 0) return null;

  async function aktifkan(id: string) {
    setMemproses(id);
    setGalat(null);
    try {
      await kirimAksi(`/api/dashboard/kamar/${id}`, { aktif: true }, "PATCH");
      router.refresh();
    } catch (err) {
      setGalat((err as Error).message);
    } finally {
      setMemproses(null);
    }
  }

  return (
    <details className="rounded-xl border bg-card">
      <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-medium">
        Kamar nonaktif<span className="ml-1.5 font-normal text-muted-foreground">· {kamar.length}</span>
      </summary>
      <ul className="divide-y border-t">
        {kamar.map((k) => (
          <li key={k.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <div className="min-w-0 flex-1">
              <p className="font-medium tabular-nums">
                {k.nomorKamar} <span className="font-normal text-muted-foreground">· {k.tipe}</span>
              </p>
              {k.catatan && <p className="truncate text-xs text-muted-foreground">{k.catatan}</p>}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-9 shrink-0"
              disabled={memproses !== null}
              aria-label={`Aktifkan lagi kamar ${k.nomorKamar}`}
              onClick={() => aktifkan(k.id)}
            >
              <RotateCcw data-icon="inline-start" />
              {memproses === k.id ? "Memproses…" : "Aktifkan lagi"}
            </Button>
          </li>
        ))}
      </ul>
      {galat && (
        <div className="border-t p-3">
          <GalatServer pesan={galat} />
        </div>
      )}
    </details>
  );
}

/** Kamar kosong yang siap ditawarkan: saring per tipe & urutkan (tersimpan di URL). */
export function DaftarKamarKosong({ kamar, hariIni }: { kamar: KamarKosong[]; hariIni: string }) {
  const [isiKamar, setIsiKamar] = useState<string | null>(null);
  const [nonaktifkan, setNonaktifkan] = useState<KamarKosong | null>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const daftarTipe = [...new Set(kamar.map((k) => k.tipe))];
  const tipeParam = searchParams.get("tipe");
  const tipe = tipeParam && daftarTipe.includes(tipeParam) ? tipeParam : null;
  const urut = parseUrutKosong(searchParams.get("urut"));
  const tersaring = saringKamarKosong(kamar, { tipe, urut });
  const potensi = tersaring.reduce((total, k) => total + k.hargaSewa, 0);

  function setParam(nama: "tipe" | "urut", nilai: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (nilai) params.set(nama, nilai);
    else params.delete(nama);
    const query = params.toString();
    window.history.replaceState(null, "", `${pathname}${query ? `?${query}` : ""}`);
  }

  if (kamar.length === 0) {
    return (
      <Card className="items-center gap-2 px-4 py-12 text-center shadow-none">
        <p className="font-medium">Semua kamar sudah terisi</p>
        <p className="text-sm text-muted-foreground">Kamar yang ditinggal penghuni akan muncul di sini.</p>
        <Button asChild variant="outline" size="lg" className="mt-2 h-10">
          <Link href="/kamar">Lihat semua kamar</Link>
        </Button>
      </Card>
    );
  }

  const chip = (nilai: string | null, label: string, jumlah: number) => {
    const aktif = tipe === nilai;
    return (
      <button
        key={label}
        type="button"
        aria-pressed={aktif}
        onClick={() => setParam("tipe", nilai)}
        className={cn(
          "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-8",
          aktif ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
        )}
      >
        {label}
        <span className={cn("rounded-full px-1.5 text-xs tabular-nums", aktif ? "bg-primary-foreground/15" : "bg-card")}>
          {jumlah}
        </span>
      </button>
    );
  };

  return (
    <Card className="gap-0 py-0 shadow-none">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
        <div
          role="group"
          aria-label="Saring tipe kamar"
          className="flex min-w-0 flex-wrap gap-1.5"
        >
          {chip(null, "Semua", kamar.length)}
          {daftarTipe.map((t) => chip(t, t, kamar.filter((k) => k.tipe === t).length))}
        </div>
        <select
          aria-label="Urutkan kamar kosong"
          className="h-11 w-full shrink-0 rounded-lg border border-input bg-card px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-10 sm:w-56 sm:text-sm"
          value={urut}
          onChange={(e) => setParam("urut", e.target.value === "nomor" ? null : e.target.value)}
        >
          {PILIHAN_URUT_KOSONG.map(({ value, label }) => (
            <option key={value} value={value}>
              Urut: {label}
            </option>
          ))}
        </select>
      </div>

      <p className="px-4 pt-3 text-sm text-muted-foreground" aria-live="polite">
        {tersaring.length} kamar · potensi sewa{" "}
        <span className="font-medium text-foreground tabular-nums">{formatRupiah(potensi)}</span>/bulan
      </p>

      <ul className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
        {tersaring.map((k) => (
          <li key={k.id}>
            <KartuKamarKosong
              kamar={k}
              hariIni={hariIni}
              onIsi={() => setIsiKamar(k.id)}
              onNonaktifkan={() => setNonaktifkan(k)}
            />
          </li>
        ))}
      </ul>

      <ActionSheet
        open={nonaktifkan !== null}
        onOpenChange={(buka) => !buka && setNonaktifkan(null)}
        title="Nonaktifkan kamar"
        description="Untuk kamar yang sedang tidak disewakan, mis. renovasi."
      >
        {nonaktifkan && <NonaktifkanKamarFlow kamar={nonaktifkan} onSelesai={() => setNonaktifkan(null)} />}
      </ActionSheet>

      <SheetTambahPenghuni
        open={isiKamar !== null}
        onOpenChange={(buka) => !buka && setIsiKamar(null)}
        hariIni={hariIni}
        kamarKosong={kamar}
        roomIdAwal={isiKamar ?? undefined}
      />
    </Card>
  );
}
