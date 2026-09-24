"use client";

import { useState } from "react";
import { Send } from "lucide-react";

import {
  CatatanSimulasi,
  PreviewRows,
  SelesaiState,
  SheetActions,
  SheetBody,
  simulasiKirim,
} from "@/components/quick-actions/action-sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SheetClose } from "@/components/ui/sheet";
import {
  formatPeriode,
  formatRupiah,
  formatTanggal,
  selisihHari,
} from "@/lib/format";
import type { InvoiceRow } from "@/lib/types";

function isiPesan(inv: InvoiceRow, namaKos: string) {
  const namaDepan = inv.namaPenghuni.split(" ")[0];
  return `Halo ${namaDepan}, ini pengingat dari ${namaKos}. Tagihan sewa kamar ${inv.nomorKamar} periode ${formatPeriode(inv.periode)} sebesar ${formatRupiah(inv.nominal)} sudah lewat jatuh tempo (${formatTanggal(inv.jatuhTempo)}). Silakan bayar lewat link invoice berikut. Terima kasih.`;
}

/** Kirim Reminder: preview penerima, periode, nominal → konfirmasi owner → kirim. */
export function ReminderFlow({
  namaKos,
  periode,
  hariIni,
  tagihan,
}: {
  namaKos: string;
  periode: string;
  hariIni: string;
  /** Tagihan menunggak (jatuh tempo) yang bisa diingatkan. */
  tagihan: InvoiceRow[];
}) {
  const [dipilih, setDipilih] = useState(() => new Set(tagihan.map((inv) => inv.id)));
  const [status, setStatus] = useState<"preview" | "mengirim" | "selesai">("preview");

  const penerima = tagihan.filter((inv) => dipilih.has(inv.id));
  const total = penerima.reduce((jumlah, inv) => jumlah + inv.nominal, 0);

  function toggle(id: string, cek: boolean) {
    setDipilih((lama) => {
      const baru = new Set(lama);
      if (cek) baru.add(id);
      else baru.delete(id);
      return baru;
    });
  }

  async function konfirmasi() {
    setStatus("mengirim");
    await simulasiKirim();
    setStatus("selesai");
  }

  if (status === "selesai") {
    return (
      <SelesaiState
        judul={`Reminder terkirim ke ${penerima.length} penyewa`}
        pesan="Tercatat di riwayat reminder. Status tagihan berubah otomatis begitu pembayaran masuk."
      />
    );
  }

  if (tagihan.length === 0) {
    return (
      <>
        <SheetBody className="items-center justify-center py-10 text-center">
          <p className="font-medium">Tidak ada tagihan yang menunggak</p>
          <p className="text-sm text-muted-foreground">
            Semua tagihan {formatPeriode(periode)} masih aman.
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
        <section aria-labelledby="reminder-penerima">
          <h3 id="reminder-penerima" className="mb-2 text-sm font-medium">
            Penerima · tagihan jatuh tempo
          </h3>
          <ul className="divide-y rounded-lg border bg-card">
            {tagihan.map((inv) => {
              const lewat = -selisihHari(hariIni, inv.jatuhTempo);
              const id = `reminder-${inv.id}`;
              return (
                <li key={inv.id}>
                  <label htmlFor={id} className="flex cursor-pointer items-center gap-3 px-3 py-2.5">
                    <Checkbox
                      id={id}
                      checked={dipilih.has(inv.id)}
                      onCheckedChange={(cek) => toggle(inv.id, cek === true)}
                    />
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate text-sm font-medium">
                        {inv.namaPenghuni}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        Kamar {inv.nomorKamar} ·{" "}
                        <span className="text-danger">lewat {lewat} hari</span>
                      </span>
                    </span>
                    <span className="text-sm font-medium tabular-nums">
                      {formatRupiah(inv.nominal)}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>

        <PreviewRows
          rows={[
            ["Penerima", `${penerima.length} penyewa`],
            ["Periode", formatPeriode(periode)],
            ["Total nominal", formatRupiah(total)],
            ["Dikirim lewat", "WhatsApp"],
          ]}
        />

        {penerima[0] && (
          <section aria-labelledby="reminder-contoh">
            <h3 id="reminder-contoh" className="mb-2 text-sm font-medium">
              Contoh pesan untuk {penerima[0].namaPenghuni}
            </h3>
            <div className="rounded-xl rounded-tl-sm bg-accent px-3 py-2.5 text-sm text-accent-foreground">
              {isiPesan(penerima[0], namaKos)}
              <span className="mt-2 block w-fit rounded-md bg-card/70 px-2 py-1 text-xs font-medium">
                Link invoice kamar {penerima[0].nomorKamar}
              </span>
            </div>
          </section>
        )}

        <CatatanSimulasi />
      </SheetBody>

      <SheetActions>
        <SheetClose asChild>
          <Button size="lg" variant="outline">
            Batal
          </Button>
        </SheetClose>
        <Button
          size="lg"
          onClick={konfirmasi}
          disabled={penerima.length === 0 || status === "mengirim"}
        >
          <Send data-icon="inline-start" />
          {status === "mengirim" ? "Mengirim…" : `Konfirmasi & kirim (${penerima.length})`}
        </Button>
      </SheetActions>
    </>
  );
}
