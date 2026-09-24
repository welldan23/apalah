"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";

import {
  GalatServer,
  PreviewRows,
  SelesaiState,
  SheetActions,
  SheetBody,
  kirimAksi,
} from "@/components/quick-actions/action-sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SheetClose } from "@/components/ui/sheet";
import { formatPeriode, formatRupiah } from "@/lib/format";
import { keteranganWaktu } from "@/lib/invoice";
import { pesanReminder } from "@/lib/pesan";
import type { InvoiceRow } from "@/lib/types";

type Hasil = { terkirim: number; gagal: string[]; simulasi: boolean };

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
  const router = useRouter();
  const [dipilih, setDipilih] = useState(() => new Set(tagihan.map((inv) => inv.id)));
  const [status, setStatus] = useState<"preview" | "mengirim" | "selesai">("preview");
  const [hasil, setHasil] = useState<Hasil | null>(null);
  const [galatServer, setGalatServer] = useState<string | null>(null);

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
    setGalatServer(null);
    try {
      const data = await kirimAksi<Hasil>("/api/dashboard/aksi/reminder", {
        invoiceIds: penerima.map((inv) => inv.id),
      });
      setHasil(data);
      setStatus("selesai");
      router.refresh();
    } catch (err) {
      setGalatServer((err as Error).message);
      setStatus("preview");
    }
  }

  if (status === "selesai" && hasil) {
    const gagal = hasil.gagal.length
      ? ` Gagal terkirim ke kamar ${hasil.gagal.join(", ")}, coba kirim ulang nanti.`
      : "";
    return (
      <SelesaiState
        judul={`Reminder terkirim ke ${hasil.terkirim} penyewa`}
        pesan={`Tercatat di riwayat reminder. Status tagihan berubah otomatis begitu pembayaran masuk.${gagal}`}
        catatan={
          hasil.simulasi
            ? "Mode pengembangan: provider WhatsApp belum disambungkan, pesan hanya dicatat di log server."
            : undefined
        }
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
            Penerima
          </h3>
          <ul className="divide-y rounded-lg border bg-card">
            {tagihan.map((inv) => {
              const waktu = keteranganWaktu(inv, hariIni);
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
                        <span className={waktu.telat ? "text-danger" : undefined}>{waktu.teks.toLowerCase()}</span>
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
              {pesanReminder(penerima[0], namaKos)}
              <span className="mt-2 block w-fit rounded-md bg-card/70 px-2 py-1 text-xs font-medium">
                Link invoice kamar {penerima[0].nomorKamar}
              </span>
            </div>
          </section>
        )}

        <GalatServer pesan={galatServer} />
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
