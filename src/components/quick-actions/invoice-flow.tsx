"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, Search } from "lucide-react";

import {
  FieldError,
  GalatServer,
  PreviewRows,
  SelesaiState,
  SheetActions,
  SheetBody,
  kirimAksi,
} from "@/components/quick-actions/action-sheet";
import { RupiahInput } from "@/components/quick-actions/rupiah-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SheetClose } from "@/components/ui/sheet";
import {
  formatPeriode,
  formatRupiah,
  formatTanggal,
  periodeBerikutnya,
} from "@/lib/format";
import { peringatanTagihan } from "@/lib/invoice";
import type { RoomCell } from "@/lib/types";
import { cn } from "@/lib/utils";

type Langkah = "isi" | "preview" | "menyimpan" | "selesai";
type Hasil = { dibuat: number; totalNominal: number; dilewati: string[] };
type Galat = Partial<Record<"periode" | "jatuhTempo" | "kamar" | "nominal", string>>;

/** Buat Tagihan: pilih satu/banyak kamar, nominal & jatuh tempo → preview → konfirmasi owner. */
export function InvoiceFlow({
  periode,
  periodeAwal = periodeBerikutnya(periode),
  hariIni,
  kamar,
}: {
  /** Periode berjalan (YYYY-MM). */
  periode: string;
  /** Hari ini (YYYY-MM-DD, WIB) — untuk peringatan jatuh tempo yang sudah lewat. */
  hariIni: string;
  /** Periode tagihan yang dipilih saat form dibuka; default periode berikutnya. */
  periodeAwal?: string;
  /** Kamar terisi yang bisa ditagih. */
  kamar: RoomCell[];
}) {
  const router = useRouter();
  const [langkah, setLangkah] = useState<Langkah>("isi");
  const [hasil, setHasil] = useState<Hasil | null>(null);
  const [galatServer, setGalatServer] = useState<string | null>(null);
  const [periodeTagihan, setPeriodeTagihan] = useState(periodeAwal);
  const [jatuhTempo, setJatuhTempo] = useState(`${periodeAwal}-10`);
  const [dipilih, setDipilih] = useState(() => new Set(kamar.map((k) => k.id)));
  const [modeNominal, setModeNominal] = useState<"sewa" | "khusus">("sewa");
  const [nominalKhusus, setNominalKhusus] = useState<number | null>(null);
  const [cari, setCari] = useState("");
  const [galat, setGalat] = useState<Galat>({});
  // Kamar yang sudah punya tagihan di periode terpilih (dicek ke server tiap periode berganti).
  const [ditagih, setDitagih] = useState<{ periode: string; roomIds: Set<string> } | null>(null);
  const sudahDitagih = ditagih?.periode === periodeTagihan ? ditagih.roomIds : null;

  useEffect(() => {
    if (!/^\d{4}-\d{2}$/.test(periodeTagihan)) return;
    const batal = new AbortController();
    fetch(`/api/dashboard/invoices?periode=${periodeTagihan}`, { signal: batal.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { invoices: { roomId: string }[] } | null) => {
        if (data) {
          setDitagih({ periode: periodeTagihan, roomIds: new Set(data.invoices.map((inv) => inv.roomId)) });
        }
      })
      // Gagal cek tidak menghalangi: server tetap melewati kamar yang sudah ditagih.
      .catch(() => {});
    return () => batal.abort();
  }, [periodeTagihan]);

  // Galat sebuah field hilang begitu field itu diubah.
  const bersihkan = (kunci: keyof Galat) =>
    setGalat((g) => (g[kunci] ? { ...g, [kunci]: undefined } : g));

  const kataKunci = cari.trim().toLowerCase();
  const tampil = kataKunci
    ? kamar.filter(
        (k) =>
          k.nomorKamar.toLowerCase().includes(kataKunci) ||
          k.namaPenghuni?.toLowerCase().includes(kataKunci),
      )
    : kamar;

  const nominalUntuk = (k: RoomCell) =>
    modeNominal === "sewa" ? (k.hargaSewaPenghuni ?? k.hargaSewa) : (nominalKhusus ?? 0);
  const tersedia = sudahDitagih ? kamar.filter((k) => !sudahDitagih.has(k.id)) : kamar;
  const penerima = tersedia.filter((k) => dipilih.has(k.id));
  const total = penerima.reduce((jumlah, k) => jumlah + nominalUntuk(k), 0);
  const semuaDipilih = penerima.length === tersedia.length;
  const jumlahSudahDitagih = kamar.length - tersedia.length;

  function toggle(id: string, cek: boolean) {
    bersihkan("kamar");
    setDipilih((lama) => {
      const baru = new Set(lama);
      if (cek) baru.add(id);
      else baru.delete(id);
      return baru;
    });
  }

  function lanjutKePreview() {
    const g: Galat = {};
    if (!periodeTagihan) g.periode = "Pilih periode tagihan.";
    if (!jatuhTempo) g.jatuhTempo = "Isi tanggal jatuh tempo.";
    if (tersedia.length === 0) g.kamar = "Semua kamar sudah punya tagihan untuk periode ini.";
    else if (penerima.length === 0) g.kamar = "Pilih minimal satu kamar.";
    if (modeNominal === "khusus" && !nominalKhusus) g.nominal = "Isi nominal tagihan.";
    setGalat(g);
    if (Object.keys(g).length === 0) setLangkah("preview");
  }

  async function konfirmasi() {
    setLangkah("menyimpan");
    setGalatServer(null);
    try {
      const data = await kirimAksi<Hasil>("/api/dashboard/aksi/tagihan", {
        periode: periodeTagihan,
        jatuhTempo,
        roomIds: penerima.map((k) => k.id),
        nominalKhusus: modeNominal === "khusus" ? nominalKhusus : null,
      });
      setHasil(data);
      setLangkah("selesai");
      router.refresh();
    } catch (err) {
      setGalatServer((err as Error).message);
      setLangkah("preview");
    }
  }

  if (langkah === "selesai" && hasil) {
    const kamarDilewati =
      hasil.dilewati.length > 5 ? `${hasil.dilewati.length} kamar` : `Kamar ${hasil.dilewati.join(", ")}`;
    const dilewati = hasil.dilewati.length
      ? ` ${kamarDilewati} dilewati karena sudah punya tagihan periode ini.`
      : "";
    return (
      <SelesaiState
        judul={`${hasil.dibuat} tagihan ${formatPeriode(periodeTagihan)} dibuat`}
        pesan={`Total ${formatRupiah(hasil.totalNominal)}. Setiap tagihan punya link invoice publik yang bisa dibuka penyewa tanpa login.${dilewati}`}
      />
    );
  }

  if (langkah === "preview" || langkah === "menyimpan") {
    return (
      <>
        <SheetBody>
          <PreviewRows
            rows={[
              ["Penerima", `${penerima.length} penyewa`],
              ["Periode", formatPeriode(periodeTagihan)],
              ["Jatuh tempo", formatTanggal(jatuhTempo)],
              [
                "Nominal",
                modeNominal === "sewa"
                  ? "Sesuai harga sewa penghuni"
                  : `${formatRupiah(nominalKhusus ?? 0)} per kamar`,
              ],
              ["Total nominal", formatRupiah(total)],
              ...(jumlahSudahDitagih > 0
                ? [["Dilewati", `${jumlahSudahDitagih} kamar sudah ditagih`] as [string, string]]
                : []),
            ]}
          />
          {peringatanTagihan({ periode: periodeTagihan, jatuhTempo, hariIni }).map((pesan) => (
            <p key={pesan} role="status" className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
              {pesan}
            </p>
          ))}
          <p className="text-xs text-muted-foreground">
            Setiap penyewa mendapat link invoice publik. Status awal tagihan: Menunggu pembayaran.
          </p>
          <section aria-labelledby="tagihan-penerima">
            <h3 id="tagihan-penerima" className="mb-2 text-sm font-medium">
              Rincian per kamar
            </h3>
            <ul className="divide-y rounded-lg border bg-card text-sm">
              {penerima.map((k) => (
                <li key={k.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="min-w-0 truncate">
                    <span className="font-medium tabular-nums">{k.nomorKamar}</span>
                    <span className="text-muted-foreground"> · {k.namaPenghuni}</span>
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">
                    {formatRupiah(nominalUntuk(k))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <GalatServer pesan={galatServer} />
        </SheetBody>
        <SheetActions>
          <Button
            size="lg"
            variant="outline"
            onClick={() => setLangkah("isi")}
            disabled={langkah === "menyimpan"}
          >
            Ubah
          </Button>
          <Button size="lg" onClick={konfirmasi} disabled={langkah === "menyimpan"}>
            <FilePlus2 data-icon="inline-start" />
            {langkah === "menyimpan"
              ? "Membuat…"
              : `Konfirmasi & buat (${penerima.length})`}
          </Button>
        </SheetActions>
      </>
    );
  }

  return (
    <>
      <SheetBody>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tagihan-periode">Periode</Label>
            <Input
              id="tagihan-periode"
              type="month"
              className="h-10 bg-card"
              value={periodeTagihan}
              onChange={(e) => {
                bersihkan("periode");
                setPeriodeTagihan(e.target.value);
              }}
              aria-invalid={!!galat.periode}
              aria-describedby="tagihan-periode-galat"
            />
            <FieldError id="tagihan-periode-galat" pesan={galat.periode} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tagihan-jatuh-tempo">Jatuh tempo</Label>
            <Input
              id="tagihan-jatuh-tempo"
              type="date"
              className="h-10 bg-card"
              value={jatuhTempo}
              onChange={(e) => {
                bersihkan("jatuhTempo");
                setJatuhTempo(e.target.value);
              }}
              aria-invalid={!!galat.jatuhTempo}
              aria-describedby="tagihan-jatuh-tempo-galat"
            />
            <FieldError id="tagihan-jatuh-tempo-galat" pesan={galat.jatuhTempo} />
          </div>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium">Nominal</legend>
          {(
            [
              ["sewa", "Sesuai harga sewa kamar"],
              ["khusus", "Nominal sama untuk semua kamar"],
            ] as const
          ).map(([nilai, label]) => (
            <label
              key={nilai}
              className={cn(
                "flex cursor-pointer items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5 text-sm",
                modeNominal === nilai && "border-primary/50 bg-accent/40",
              )}
            >
              <input
                type="radio"
                name="mode-nominal"
                value={nilai}
                checked={modeNominal === nilai}
                onChange={() => setModeNominal(nilai)}
                className="size-4 accent-primary"
              />
              {label}
            </label>
          ))}
          {modeNominal === "khusus" && (
            <>
              <RupiahInput
                aria-label="Nominal per kamar"
                placeholder="Contoh: 650.000"
                value={nominalKhusus}
                onChange={(nilai) => {
                  bersihkan("nominal");
                  setNominalKhusus(nilai);
                }}
                aria-invalid={!!galat.nominal}
                aria-describedby="tagihan-nominal-galat"
              />
              <FieldError id="tagihan-nominal-galat" pesan={galat.nominal} />
            </>
          )}
        </fieldset>

        <section aria-labelledby="tagihan-kamar" className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <h3 id="tagihan-kamar" className="text-sm font-medium">
              Kamar · {penerima.length} dipilih
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                bersihkan("kamar");
                setDipilih(semuaDipilih ? new Set() : new Set(tersedia.map((k) => k.id)));
              }}
            >
              {semuaDipilih ? "Kosongkan" : "Pilih semua"}
            </Button>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              aria-label="Cari kamar atau penghuni"
              placeholder="Cari kamar atau penghuni"
              className="h-10 bg-card pl-8"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
            />
          </div>
          <FieldError id="tagihan-kamar-galat" pesan={galat.kamar} />
          <ul className="divide-y rounded-lg border bg-card">
            {tampil.map((k) => {
              const id = `tagihan-${k.id}`;
              const ditagihPeriodeIni = sudahDitagih?.has(k.id) ?? false;
              return (
                <li key={k.id}>
                  <label
                    htmlFor={id}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2",
                      ditagihPeriodeIni ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                    )}
                  >
                    <Checkbox
                      id={id}
                      checked={!ditagihPeriodeIni && dipilih.has(k.id)}
                      disabled={ditagihPeriodeIni}
                      onCheckedChange={(cek) => toggle(k.id, cek === true)}
                    />
                    <span className="w-9 shrink-0 text-sm font-medium tabular-nums">
                      {k.nomorKamar}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                      {k.namaPenghuni}
                    </span>
                    {ditagihPeriodeIni ? (
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        Sudah ditagih
                      </span>
                    ) : (
                      <span className="shrink-0 text-sm tabular-nums">
                        {formatRupiah(nominalUntuk(k))}
                      </span>
                    )}
                  </label>
                </li>
              );
            })}
            {tampil.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                Tidak ada kamar yang cocok.
              </li>
            )}
          </ul>
        </section>
      </SheetBody>

      <SheetActions>
        <SheetClose asChild>
          <Button size="lg" variant="outline">
            Batal
          </Button>
        </SheetClose>
        <Button size="lg" onClick={lanjutKePreview}>
          Lihat preview
        </Button>
      </SheetActions>
    </>
  );
}
