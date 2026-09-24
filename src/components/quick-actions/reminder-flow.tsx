"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";

import {
  GalatServer,
  PreviewRows,
  SheetActions,
  SheetBody,
  kirimAksi,
} from "@/components/quick-actions/action-sheet";
import { HasilKirim, type HasilKirimReminder } from "@/components/reminder/hasil-kirim";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SheetClose } from "@/components/ui/sheet";
import type { PreviewReminder } from "@/lib/aksi/preview-reminder";
import { formatPeriode, formatRupiah, formatWaktu } from "@/lib/format";
import { keteranganWaktu } from "@/lib/invoice";
import type { InvoiceRow } from "@/lib/types";


/** Kirim Reminder: preview penerima, periode, nominal → konfirmasi owner → kirim. */
export function ReminderFlow({
  periode,
  hariIni,
  tagihan,
}: {
  periode: string;
  hariIni: string;
  /** Tagihan menunggak (jatuh tempo) yang bisa diingatkan. */
  tagihan: InvoiceRow[];
}) {
  const router = useRouter();
  const [dipilih, setDipilih] = useState(() => new Set(tagihan.map((inv) => inv.id)));
  const [status, setStatus] = useState<"preview" | "mengirim" | "selesai">("preview");
  const [hasil, setHasil] = useState<HasilKirimReminder | null>(null);
  /** Tagihan yang dikirimi saat konfirmasi (tetap walau pilihan berubah). */
  const [terkirimKe, setTerkirimKe] = useState<InvoiceRow[]>([]);
  const [mengirimUlang, setMengirimUlang] = useState(false);
  const [galatServer, setGalatServer] = useState<string | null>(null);
  /** Preview dari server: isi pesan persis & penyewa yang dilewati (sudah dihubungi < 24 jam). */
  const [preview, setPreview] = useState<PreviewReminder | null>(null);

  useEffect(() => {
    if (tagihan.length === 0) return;
    let batal = false;
    kirimAksi<PreviewReminder>("/api/dashboard/aksi/reminder/preview", { invoiceIds: tagihan.map((inv) => inv.id) })
      .then((data) => !batal && setPreview(data))
      .catch((err: Error) => !batal && setGalatServer(err.message));
    return () => {
      batal = true;
    };
  }, [tagihan]);

  const dilewati = new Map(preview?.dilewati.map((d) => [d.invoiceId, d]));
  const pesanServer = new Map(preview?.penerima.map((p) => [p.invoiceId, p.pesan]));
  const penerima = tagihan.filter((inv) => dipilih.has(inv.id) && !dilewati.has(inv.id));
  const total = penerima.reduce((jumlah, inv) => jumlah + inv.nominal, 0);
  const lewat = penerima.filter((inv) => inv.jatuhTempo < hariIni).length;
  const daftarPeriode = [...new Set(penerima.map((inv) => inv.periode))].sort();
  const [contohId, setContohId] = useState<string | null>(null);
  const contoh = penerima.find((inv) => inv.id === contohId) ?? penerima[0];

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
      const data = await kirimAksi<HasilKirimReminder>("/api/dashboard/aksi/reminder", {
        invoiceIds: penerima.map((inv) => inv.id),
      });
      setTerkirimKe(penerima);
      setHasil(data);
      setStatus("selesai");
      router.refresh();
    } catch (err) {
      setGalatServer((err as Error).message);
      setStatus("preview");
    }
  }

  /** Kirim ulang hanya ke yang gagal; angka terkirim bertambah, daftar gagal diganti. */
  async function kirimUlang(invoiceIds: string[]) {
    setMengirimUlang(true);
    setGalatServer(null);
    try {
      const data = await kirimAksi<HasilKirimReminder>("/api/dashboard/aksi/reminder", { invoiceIds });
      setHasil((lama) => (lama ? { ...data, terkirim: lama.terkirim + data.terkirim } : data));
      router.refresh();
    } catch (err) {
      setGalatServer((err as Error).message);
    } finally {
      setMengirimUlang(false);
    }
  }

  if (status === "selesai" && hasil) {
    return (
      <HasilKirim
        hasil={hasil}
        penerima={terkirimKe}
        onKirimUlang={kirimUlang}
        mengirimUlang={mengirimUlang}
        galat={galatServer}
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
              const lewati = dilewati.get(inv.id);
              return (
                <li key={inv.id} className={lewati ? "opacity-60" : undefined}>
                  <label htmlFor={id} className="flex cursor-pointer items-center gap-3 px-3 py-2.5">
                    <Checkbox
                      id={id}
                      checked={dipilih.has(inv.id) && !lewati}
                      disabled={!!lewati}
                      onCheckedChange={(cek) => toggle(inv.id, cek === true)}
                    />
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate text-sm font-medium">
                        {inv.namaPenghuni}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        Kamar {inv.nomorKamar} ·{" "}
                        {lewati ? (
                          `sudah dihubungi ${formatWaktu(lewati.terakhirDihubungi)} — dilewati`
                        ) : (
                          <span className={waktu.telat ? "text-danger" : undefined}>{waktu.teks.toLowerCase()}</span>
                        )}
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
            ["Periode", daftarPeriode.length ? daftarPeriode.map(formatPeriode).join(", ") : formatPeriode(periode)],
            ["Total nominal", formatRupiah(total)],
            ...(lewat && lewat < penerima.length
              ? [["Status", `${lewat} lewat jatuh tempo · ${penerima.length - lewat} belum`] as [string, string]]
              : []),
            ...(dilewati.size
              ? [["Dilewati", `${dilewati.size} penyewa (sudah dihubungi < 24 jam)`] as [string, string]]
              : []),
            ["Dikirim lewat", "WhatsApp, satu per satu"],
          ]}
        />

        {contoh && (
          <section aria-labelledby="reminder-contoh" className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <h3 id="reminder-contoh" className="text-sm font-medium">
                Isi pesan
              </h3>
              {penerima.length > 1 && (
                <select
                  aria-label="Lihat pesan untuk penerima"
                  className="h-10 max-w-[60%] rounded-lg border border-input bg-card px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  value={contoh.id}
                  onChange={(e) => setContohId(e.target.value)}
                >
                  {penerima.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.nomorKamar} · {inv.namaPenghuni}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div
              aria-busy={!preview}
              className="rounded-xl rounded-tl-sm bg-accent px-3 py-2.5 text-sm break-words whitespace-pre-line text-accent-foreground"
            >
              {pesanServer.get(contoh.id) ?? (galatServer ? "Pesan belum bisa ditampilkan." : "Menyiapkan isi pesan…")}
            </div>
            <p className="text-xs text-muted-foreground">
              Angka & tanggal diambil dari data tagihan, bukan dibuat AI. Tiap penyewa menerima pesan dengan datanya sendiri.
            </p>
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
          disabled={!preview || penerima.length === 0 || status === "mengirim"}
        >
          <Send data-icon="inline-start" />
          {status === "mengirim" ? "Mengirim…" : `Konfirmasi & kirim (${penerima.length})`}
        </Button>
      </SheetActions>
    </>
  );
}
