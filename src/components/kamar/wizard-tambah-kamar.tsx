"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, CircleCheck, Plus, Trash2 } from "lucide-react";

import { CatatanSimulasi, FieldError, PreviewRows } from "@/components/quick-actions/action-sheet";
import { RupiahInput } from "@/components/quick-actions/rupiah-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { HalamanTambahKamar } from "@/lib/data/tambah-kamar";
import { formatRupiah, formatRupiahSingkat } from "@/lib/format";
import { buatDaftarKamar, periksaRencana, type RencanaTipe } from "@/lib/rencana-kamar";
import { cn } from "@/lib/utils";

type Langkah = 1 | 2 | 3 | "selesai";
type Tujuan = "kos_ini" | "kos_baru";

const LANGKAH = ["Tujuan", "Tipe kamar", "Preview"] as const;

/** "A13–A14" atau "A13" untuk satu kamar. */
const rentang = (nomor: string[]) =>
  nomor.length > 1 ? `${nomor[0]}–${nomor.at(-1)}` : (nomor[0] ?? "—");

/** Wizard Tambah kos & kamar: tujuan → tipe kamar (nomor otomatis) → preview & konfirmasi. */
export function WizardTambahKamar({ namaKos, nomorKamarAda, tipeAda }: HalamanTambahKamar) {
  const [langkah, setLangkah] = useState<Langkah>(1);
  const [tujuan, setTujuan] = useState<Tujuan>("kos_ini");
  const [namaKosBaru, setNamaKosBaru] = useState("");
  const [alamatBaru, setAlamatBaru] = useState("");
  const [rencana, setRencana] = useState<RencanaTipe[]>(
    tipeAda.length > 0 ? tipeAda : [{ tipe: "", kode: "A", jumlah: 10, hargaSewa: 0 }],
  );
  const [galatKos, setGalatKos] = useState("");
  const [cekRencana, setCekRencana] = useState(false);

  const nomorAda = tujuan === "kos_ini" ? nomorKamarAda : [];
  const galatBaris = periksaRencana(rencana);
  const rencanaValid = galatBaris.every((g) => !g);
  const kamarBaru = rencanaValid ? buatDaftarKamar(rencana, nomorAda) : [];
  const namaTujuan = tujuan === "kos_ini" ? namaKos : namaKosBaru.trim() || "Kos baru";

  /** Nomor kamar per baris (bila baris sampai baris itu valid) untuk ringkasan langsung. */
  function nomorPerBaris(i: number) {
    if (galatBaris.slice(0, i + 1).some((g) => g)) return null;
    const sebelum = buatDaftarKamar(rencana.slice(0, i), nomorAda).length;
    return buatDaftarKamar(rencana.slice(0, i + 1), nomorAda)
      .slice(sebelum)
      .map((k) => k.nomorKamar);
  }

  const ubahBaris = (i: number, perubahan: Partial<RencanaTipe>) =>
    setRencana((r) => r.map((baris, j) => (j === i ? { ...baris, ...perubahan } : baris)));

  function lanjutDariTujuan() {
    if (tujuan === "kos_baru" && !namaKosBaru.trim()) {
      setGalatKos("Isi nama kos baru.");
      return;
    }
    setGalatKos("");
    setLangkah(2);
  }

  function lanjutDariRencana() {
    setCekRencana(true);
    if (rencanaValid) setLangkah(3);
  }

  if (langkah === "selesai") {
    return (
      <Card className="items-center gap-3 px-4 py-10 text-center shadow-none">
        <span className="grid size-12 place-items-center rounded-full bg-success-soft text-success">
          <CircleCheck className="size-6" />
        </span>
        <p className="text-lg font-semibold">
          {kamarBaru.length} kamar ditambahkan ke {namaTujuan}
        </p>
        <p className="text-sm text-muted-foreground">
          Kamar baru berstatus kosong dan langsung bisa diisi penghuni.
        </p>
        <CatatanSimulasi>Mode contoh: kamar belum benar-benar disimpan ke server.</CatatanSimulasi>
        <Button asChild size="lg" className="mt-2 h-11">
          <Link href="/kamar">Kembali ke daftar kamar</Link>
        </Button>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <ol aria-label="Langkah" className="grid grid-cols-3 gap-2">
        {LANGKAH.map((label, i) => {
          const nomor = i + 1;
          const aktif = langkah === nomor;
          const lewat = typeof langkah === "number" && langkah > nomor;
          return (
            <li
              key={label}
              aria-current={aktif ? "step" : undefined}
              className={cn(
                "flex flex-col gap-1.5 border-t-4 pt-2 text-xs",
                aktif || lewat ? "border-primary text-foreground" : "border-muted text-muted-foreground",
              )}
            >
              <span className="font-medium">
                {nomor}. {label}
              </span>
            </li>
          );
        })}
      </ol>

      {langkah === 1 && (
        <Card className="shadow-none">
          <CardContent className="flex flex-col gap-4">
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1.5 text-sm font-medium">Tambah kamar ke mana?</legend>
              {(
                [
                  ["kos_ini", `Kamar baru di ${namaKos}`, "Nomor kamar melanjutkan yang sudah ada."],
                  ["kos_baru", "Daftarkan kos baru", "Kos baru mendapat ruang kerja sendiri."],
                ] as const
              ).map(([nilai, label, keterangan]) => (
                <label
                  key={nilai}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border bg-card px-3 py-3 text-sm",
                    tujuan === nilai && "border-primary/50 bg-accent/40",
                  )}
                >
                  <input
                    type="radio"
                    name="tujuan"
                    value={nilai}
                    checked={tujuan === nilai}
                    onChange={() => setTujuan(nilai)}
                    className="mt-0.5 size-4 accent-primary"
                  />
                  <span>
                    <span className="block font-medium">{label}</span>
                    <span className="block text-xs text-muted-foreground">{keterangan}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            {tujuan === "kos_baru" && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="kos-nama">Nama kos</Label>
                  <Input
                    id="kos-nama"
                    className="h-11 bg-card text-base sm:h-10 sm:text-sm"
                    placeholder="Mis. Kos Mawar"
                    value={namaKosBaru}
                    onChange={(e) => {
                      setGalatKos("");
                      setNamaKosBaru(e.target.value);
                    }}
                    aria-invalid={!!galatKos}
                    aria-describedby="kos-nama-galat"
                  />
                  <FieldError id="kos-nama-galat" pesan={galatKos} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="kos-alamat">Alamat (opsional)</Label>
                  <Input
                    id="kos-alamat"
                    className="h-11 bg-card text-base sm:h-10 sm:text-sm"
                    placeholder="Jalan, kelurahan, kota"
                    value={alamatBaru}
                    onChange={(e) => setAlamatBaru(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button asChild variant="outline" size="lg" className="h-11">
                <Link href="/kamar">Batal</Link>
              </Button>
              <Button size="lg" className="h-11" onClick={lanjutDariTujuan}>
                Lanjut
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {langkah === 2 && (
        <Card className="shadow-none">
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Isi tipe kamar, kode awal, jumlah, dan harga. Nomor kamar dibuat otomatis.
            </p>
            <ul className="flex flex-col gap-3">
              {rencana.map((baris, i) => {
                const nomor = nomorPerBaris(i);
                const galat = cekRencana ? galatBaris[i] : "";
                return (
                  <li key={i} className="flex flex-col gap-3 rounded-xl border bg-card p-3">
                    <div className="grid grid-cols-[1fr_4.5rem] gap-2 sm:grid-cols-[1fr_4.5rem_5.5rem_10rem]">
                      <div className="flex flex-col gap-1">
                        <Label htmlFor={`tipe-${i}`} className="text-xs">
                          Tipe
                        </Label>
                        <Input
                          id={`tipe-${i}`}
                          className="h-11 bg-card text-base sm:h-10 sm:text-sm"
                          placeholder="Mis. Standar"
                          value={baris.tipe}
                          onChange={(e) => ubahBaris(i, { tipe: e.target.value })}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label htmlFor={`kode-${i}`} className="text-xs">
                          Kode
                        </Label>
                        <Input
                          id={`kode-${i}`}
                          maxLength={3}
                          className="h-11 bg-card text-center text-base uppercase sm:h-10 sm:text-sm"
                          value={baris.kode}
                          onChange={(e) => ubahBaris(i, { kode: e.target.value.toUpperCase() })}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label htmlFor={`jumlah-${i}`} className="text-xs">
                          Jumlah
                        </Label>
                        <Input
                          id={`jumlah-${i}`}
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={200}
                          className="h-11 bg-card text-base tabular-nums sm:h-10 sm:text-sm"
                          value={baris.jumlah || ""}
                          onChange={(e) => ubahBaris(i, { jumlah: Number(e.target.value) })}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label htmlFor={`harga-${i}`} className="text-xs">
                          Harga/bulan
                        </Label>
                        <RupiahInput
                          id={`harga-${i}`}
                          value={baris.hargaSewa || null}
                          onChange={(nilai) => ubahBaris(i, { hargaSewa: nilai ?? 0 })}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-muted-foreground">
                        {nomor ? `Nomor ${rentang(nomor)}` : "Lengkapi baris untuk melihat nomor kamar"}
                      </span>
                      {rencana.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 text-danger"
                          onClick={() => setRencana((r) => r.filter((_, j) => j !== i))}
                        >
                          <Trash2 data-icon="inline-start" />
                          Hapus
                        </Button>
                      )}
                    </div>
                    <FieldError id={`rencana-${i}-galat`} pesan={galat || undefined} />
                  </li>
                );
              })}
            </ul>
            <Button
              variant="outline"
              size="lg"
              className="h-11 self-start"
              onClick={() => setRencana((r) => [...r, { tipe: "", kode: "", jumlah: 1, hargaSewa: 0 }])}
            >
              <Plus data-icon="inline-start" />
              Tambah tipe
            </Button>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="lg" className="h-11" onClick={() => setLangkah(1)}>
                Kembali
              </Button>
              <Button size="lg" className="h-11" onClick={lanjutDariRencana}>
                Lihat preview
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {langkah === 3 && (
        <Card className="shadow-none">
          <CardContent className="flex flex-col gap-4">
            <p className="flex items-center gap-2 font-medium">
              <Building2 className="size-4 text-primary" aria-hidden="true" />
              {namaTujuan}
            </p>
            <PreviewRows
              rows={[
                ["Kamar baru", `${kamarBaru.length} kamar`],
                ...rencana.map(
                  (r, i) =>
                    [
                      r.tipe.trim(),
                      `${rentang(nomorPerBaris(i) ?? [])} · ${formatRupiahSingkat(r.hargaSewa)}/bln`,
                    ] as [string, string],
                ),
                [
                  "Potensi sewa/bulan",
                  formatRupiah(kamarBaru.reduce((total, k) => total + k.hargaSewa, 0)),
                ],
              ]}
            />
            <section aria-labelledby="nomor-baru-judul">
              <h3 id="nomor-baru-judul" className="mb-2 text-sm font-medium">
                Nomor kamar baru
              </h3>
              <ul className="flex flex-wrap gap-1.5">
                {kamarBaru.slice(0, 60).map((k) => (
                  <li
                    key={k.nomorKamar}
                    className="rounded-md border border-dashed border-warning/60 bg-warning-soft px-2 py-1 text-xs font-semibold text-warning tabular-nums"
                  >
                    {k.nomorKamar}
                  </li>
                ))}
                {kamarBaru.length > 60 && (
                  <li className="px-2 py-1 text-xs text-muted-foreground">+{kamarBaru.length - 60} lainnya</li>
                )}
              </ul>
            </section>
            <p className="text-xs text-muted-foreground">
              Semua kamar baru berstatus kosong. Tagihan baru dibuat setelah kamar diisi penghuni.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="lg" className="h-11" onClick={() => setLangkah(2)}>
                Ubah
              </Button>
              <Button size="lg" className="h-11" onClick={() => setLangkah("selesai")}>
                Konfirmasi &amp; simpan ({kamarBaru.length})
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
