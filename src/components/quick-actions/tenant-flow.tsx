"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SheetClose } from "@/components/ui/sheet";
import { formatRupiah, formatRupiahSingkat, formatTanggal } from "@/lib/format";
import { normalisasiNomorWa, tampilNomorWa } from "@/lib/nomor-wa";
import type { RoomCell } from "@/lib/types";

type Langkah = "isi" | "preview" | "menyimpan" | "selesai";
type Galat = Partial<Record<"nama" | "nomorWa" | "kamar" | "tanggalMasuk" | "hargaSewa", string>>;

/** Tambah Penghuni: data penghuni + kamar kosong → preview → konfirmasi owner. */
export function TenantFlow({
  hariIni,
  kamarKosong,
  roomIdAwal,
}: {
  hariIni: string;
  kamarKosong: RoomCell[];
  /** Kamar yang langsung terpilih, mis. dari tombol "Isi kamar". */
  roomIdAwal?: string;
}) {
  const router = useRouter();
  const [langkah, setLangkah] = useState<Langkah>("isi");
  const [galatServer, setGalatServer] = useState<string | null>(null);
  const [nama, setNama] = useState("");
  const [nomorWa, setNomorWa] = useState("");
  const [roomId, setRoomId] = useState(roomIdAwal ?? "");
  const [tanggalMasuk, setTanggalMasuk] = useState(hariIni);
  const [hargaSewa, setHargaSewa] = useState<number | null>(
    () => kamarKosong.find((k) => k.id === roomIdAwal)?.hargaSewa ?? null,
  );
  const [galat, setGalat] = useState<Galat>({});

  const kamar = kamarKosong.find((k) => k.id === roomId);
  const nomorValid = normalisasiNomorWa(nomorWa);

  // Galat sebuah field hilang begitu field itu diubah.
  const bersihkan = (kunci: keyof Galat) =>
    setGalat((g) => (g[kunci] ? { ...g, [kunci]: undefined } : g));

  function pilihKamar(id: string) {
    bersihkan("kamar");
    bersihkan("hargaSewa");
    setRoomId(id);
    // Harga sewa mengikuti kamar yang dipilih; owner tetap bisa mengubahnya.
    setHargaSewa(kamarKosong.find((k) => k.id === id)?.hargaSewa ?? null);
  }

  function lanjutKePreview() {
    const g: Galat = {};
    if (!nama.trim()) g.nama = "Isi nama penghuni.";
    if (!nomorValid) g.nomorWa = "Nomor WhatsApp tidak valid, contoh 0812 3456 7890.";
    if (!kamar) g.kamar = "Pilih kamar yang masih kosong.";
    if (!tanggalMasuk) g.tanggalMasuk = "Isi tanggal masuk.";
    if (!hargaSewa) g.hargaSewa = "Isi harga sewa per bulan.";
    setGalat(g);
    if (Object.keys(g).length === 0) setLangkah("preview");
  }

  async function konfirmasi() {
    setLangkah("menyimpan");
    setGalatServer(null);
    try {
      await kirimAksi("/api/dashboard/aksi/penghuni", {
        nama: nama.trim(),
        nomorWa: nomorValid,
        roomId,
        tanggalMasuk,
        hargaSewa,
      });
      setLangkah("selesai");
      router.refresh();
    } catch (err) {
      setGalatServer((err as Error).message);
      setLangkah("preview");
    }
  }

  if (langkah === "selesai") {
    return (
      <SelesaiState
        judul={`${nama.trim()} tercatat di kamar ${kamar?.nomorKamar}`}
        pesan="Kamar berubah jadi terisi dan tagihan bulanan penghuni ini bisa langsung dibuat."
      />
    );
  }

  if (langkah === "preview" || langkah === "menyimpan") {
    return (
      <>
        <SheetBody>
          <PreviewRows
            rows={[
              ["Nama", nama.trim()],
              ["WhatsApp", nomorValid ? tampilNomorWa(nomorValid) : "—"],
              ["Kamar", kamar ? `${kamar.nomorKamar} · ${kamar.tipe}` : "—"],
              ["Tanggal masuk", formatTanggal(tanggalMasuk)],
              ["Harga sewa", `${formatRupiah(hargaSewa ?? 0)}/bulan`],
              ["Jatuh tempo", `Tiap tanggal ${Number(tanggalMasuk.slice(8, 10))}, ikut tanggal masuk`],
            ]}
          />
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
            <UserPlus data-icon="inline-start" />
            {langkah === "menyimpan" ? "Menyimpan…" : "Konfirmasi & simpan"}
          </Button>
        </SheetActions>
      </>
    );
  }

  if (kamarKosong.length === 0) {
    return (
      <>
        <SheetBody className="items-center justify-center py-10 text-center">
          <p className="font-medium">Semua kamar sudah terisi</p>
          <p className="text-sm text-muted-foreground">
            Kosongkan kamar lebih dulu sebelum menambah penghuni baru.
          </p>
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

  return (
    <>
      <SheetBody>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="penghuni-nama">Nama penghuni</Label>
          <Input
            id="penghuni-nama"
            autoComplete="off"
            className="h-10 bg-card"
            placeholder="Nama lengkap"
            value={nama}
            onChange={(e) => {
              bersihkan("nama");
              setNama(e.target.value);
            }}
            aria-invalid={!!galat.nama}
            aria-describedby="penghuni-nama-galat"
          />
          <FieldError id="penghuni-nama-galat" pesan={galat.nama} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="penghuni-wa">Nomor WhatsApp</Label>
          <Input
            id="penghuni-wa"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            className="h-10 bg-card"
            placeholder="0812 3456 7890"
            value={nomorWa}
            onChange={(e) => {
              bersihkan("nomorWa");
              setNomorWa(e.target.value);
            }}
            aria-invalid={!!galat.nomorWa}
            aria-describedby="penghuni-wa-galat penghuni-wa-info"
          />
          <p id="penghuni-wa-info" className="text-xs text-muted-foreground">
            Tagihan dan pengingat dikirim ke nomor ini.
          </p>
          <FieldError id="penghuni-wa-galat" pesan={galat.nomorWa} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="penghuni-kamar">Kamar</Label>
          <select
            id="penghuni-kamar"
            className="h-10 w-full rounded-lg border border-input bg-card px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm"
            value={roomId}
            onChange={(e) => pilihKamar(e.target.value)}
            aria-invalid={!!galat.kamar}
            aria-describedby="penghuni-kamar-galat"
          >
            <option value="" disabled>
              Pilih kamar kosong ({kamarKosong.length} tersedia)
            </option>
            {kamarKosong.map((k) => (
              <option key={k.id} value={k.id}>
                {k.nomorKamar} · {k.tipe} · {formatRupiahSingkat(k.hargaSewa)}/bln
              </option>
            ))}
          </select>
          <FieldError id="penghuni-kamar-galat" pesan={galat.kamar} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="penghuni-masuk">Tanggal masuk</Label>
            <Input
              id="penghuni-masuk"
              type="date"
              className="h-10 bg-card"
              value={tanggalMasuk}
              onChange={(e) => {
                bersihkan("tanggalMasuk");
                setTanggalMasuk(e.target.value);
              }}
              aria-invalid={!!galat.tanggalMasuk}
              aria-describedby="penghuni-masuk-galat"
            />
            <FieldError id="penghuni-masuk-galat" pesan={galat.tanggalMasuk} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="penghuni-harga">Harga sewa/bulan</Label>
            <RupiahInput
              id="penghuni-harga"
              value={hargaSewa}
              onChange={(nilai) => {
                bersihkan("hargaSewa");
                setHargaSewa(nilai);
              }}
              aria-invalid={!!galat.hargaSewa}
              aria-describedby="penghuni-harga-galat"
            />
            <FieldError id="penghuni-harga-galat" pesan={galat.hargaSewa} />
          </div>
        </div>
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
