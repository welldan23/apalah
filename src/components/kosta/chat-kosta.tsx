"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { ArrowLeftRight, SendHorizontal } from "lucide-react";

import { BubblePesan } from "@/components/kosta/bubble-pesan";
import { PemilihWorkspace } from "@/components/kosta/pemilih-workspace";
import { ActionSheet } from "@/components/quick-actions/action-sheet";
import { statusSetelah, type KeputusanDraft } from "@/lib/draft-aksi";
import { formatTanggal } from "@/lib/format";
import { tampilNomorWa } from "@/lib/nomor-wa";
import type { PesanKosta, PreviewAksi, WorkspaceRingkas } from "@/lib/types";
import { tanggalWib } from "@/lib/waktu";

const JEDA_BALASAN = 1100;

const BALASAN_CONTOH =
  "Mode contoh: Kosta belum tersambung ke layanan AI. Setelah aktif, pertanyaanmu dijawab dengan angka langsung dari database kos.";

const CATATAN_CONTOH = "(Mode contoh: belum benar-benar dijalankan.)";

function pesanSelesai(preview: PreviewAksi) {
  const jumlah = preview.penerima.length;
  return preview.aksi === "reminder"
    ? `Reminder terkirim ke ${jumlah} penyewa dan tercatat di riwayat reminder. ${CATATAN_CONTOH}`
    : `${jumlah} tagihan dibuat, masing-masing dengan link invoice untuk penyewa. ${CATATAN_CONTOH}`;
}

function labelTanggal(tanggal: string, hariIni: string) {
  return tanggal === hariIni ? "Hari ini" : formatTanggal(tanggal);
}

function IndikatorMengetik() {
  return (
    <li className="flex justify-start" aria-label="Kosta sedang mengetik">
      <span className="flex gap-1 rounded-2xl rounded-bl-sm bg-card px-3 py-3 shadow-xs">
        {[0, 150, 300].map((jeda) => (
          <span
            key={jeda}
            className="size-1.5 rounded-full bg-muted-foreground/60 motion-safe:animate-bounce"
            style={{ animationDelay: `${jeda}ms` }}
          />
        ))}
      </span>
    </li>
  );
}

/** Panel chat owner dengan Kosta — isi sama dengan percakapan di WhatsApp. */
export function ChatKosta({
  hariIni,
  workspaceAktif,
  workspaces,
  nomorWa,
  pesan: awal,
}: {
  hariIni: string;
  workspaceAktif: string;
  workspaces: WorkspaceRingkas[];
  nomorWa: string;
  pesan: PesanKosta[];
}) {
  const [pesan, setPesan] = useState(awal);
  const [aktifId, setAktifId] = useState(workspaceAktif);
  const [pilihKosTerbuka, setPilihKosTerbuka] = useState(false);
  const aktif = workspaces.find((ws) => ws.id === aktifId) ?? workspaces[0];
  const [draf, setDraf] = useState("");
  const [mengetik, setMengetik] = useState(false);
  const bawahRef = useRef<HTMLLIElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const tambahPesan = (dari: PesanKosta["dari"], teks: string) =>
    setPesan((p) => [...p, { id: crypto.randomUUID(), dari, waktu: new Date().toISOString(), teks }]);

  /** Balasan Kosta setelah jeda "mengetik". */
  function balasKosta(teks: string, sebelumBalas?: () => void) {
    setMengetik(true);
    timers.current.push(
      setTimeout(() => {
        setMengetik(false);
        sebelumBalas?.();
        tambahPesan("kosta", teks);
      }, JEDA_BALASAN),
    );
  }

  const ubahStatusDraft = (pesanId: string, keputusan: KeputusanDraft) =>
    setPesan((p) =>
      p.map((m) => {
        if (m.id !== pesanId || m.lampiran?.jenis !== "preview_aksi") return m;
        const status = statusSetelah(m.lampiran.status, keputusan);
        return status ? { ...m, lampiran: { ...m.lampiran, status } } : m;
      }),
    );

  function putuskan(pesanId: string, keputusan: "setuju" | "batal") {
    const lampiran = pesan.find((m) => m.id === pesanId)?.lampiran;
    if (lampiran?.jenis !== "preview_aksi" || !statusSetelah(lampiran.status, keputusan)) return;

    ubahStatusDraft(pesanId, keputusan);
    if (keputusan === "batal") {
      tambahPesan("owner", "Batal");
      balasKosta("Oke, dibatalkan. Tidak ada yang dikirim atau diubah.");
    } else {
      tambahPesan("owner", lampiran.aksi === "reminder" ? "Setuju, kirim" : "Setuju, buat");
      balasKosta(pesanSelesai(lampiran), () => ubahStatusDraft(pesanId, "selesai"));
    }
  }
  // Selalu tampilkan pesan terbaru.
  useEffect(() => {
    bawahRef.current?.scrollIntoView({ block: "end" });
  }, [pesan.length, mengetik]);

  function kirim(e: React.FormEvent) {
    e.preventDefault();
    const teks = draf.trim();
    if (!teks || mengetik) return;
    tambahPesan("owner", teks);
    setDraf("");
    balasKosta(BALASAN_CONTOH);
  }

  function gantiKos(ws: WorkspaceRingkas) {
    setPilihKosTerbuka(false);
    if (ws.id === aktifId) return;
    setAktifId(ws.id);
    tambahPesan(
      "kosta",
      `Oke, sekarang aku bantu untuk ${ws.namaKos} (${ws.jumlahKamar} kamar). Data kos lain tidak ikut dibaca.`,
    );
  }

  // Kelompokkan per tanggal WIB untuk pemisah "Hari ini" / tanggal.
  const grup: { tanggal: string; pesan: PesanKosta[] }[] = [];
  for (const p of pesan) {
    const tanggal = tanggalWib(new Date(p.waktu));
    const terakhir = grup.at(-1);
    if (terakhir?.tanggal === tanggal) terakhir.pesan.push(p);
    else grup.push({ tanggal, pesan: [p] });
  }

  return (
    <section
      aria-labelledby="kosta-judul"
      className="flex h-[calc(100dvh-15.5rem)] min-h-96 flex-col overflow-hidden rounded-2xl border bg-muted lg:h-[calc(100dvh-11rem)]"
    >
      <header className="flex items-center gap-3 bg-primary px-4 py-3 text-primary-foreground">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent font-semibold text-accent-foreground">
          K
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <h2 id="kosta-judul" className="font-semibold">
            Kosta
          </h2>
          <p className="truncate text-xs text-primary-foreground/75">
            {mengetik ? "mengetik…" : `${aktif.namaKos} · WhatsApp ${tampilNomorWa(nomorWa)}`}
          </p>
        </div>
        {workspaces.length > 1 && (
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => setPilihKosTerbuka(true)}
            className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-primary-foreground/10 px-3 text-sm font-medium outline-none hover:bg-primary-foreground/20 focus-visible:ring-3 focus-visible:ring-accent/40"
          >
            <ArrowLeftRight className="size-4" aria-hidden="true" />
            Ganti kos
          </button>
        )}
      </header>

      <ActionSheet
        open={pilihKosTerbuka}
        onOpenChange={setPilihKosTerbuka}
        title="Pilih kos"
        description="Kosta hanya membaca data kos yang dipilih."
      >
        <div className="overflow-y-auto p-4">
          <PemilihWorkspace workspaces={workspaces} aktifId={aktif.id} onPilih={gantiKos} />
        </div>
      </ActionSheet>

      <ol
        aria-label="Percakapan dengan Kosta"
        aria-live="polite"
        className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 py-4 sm:px-5"
      >
        {grup.map(({ tanggal, pesan }) => (
          <Fragment key={tanggal}>
            <li className="my-1 self-center rounded-md bg-card/80 px-2 py-0.5 text-xs text-muted-foreground">
              <time dateTime={tanggal}>{labelTanggal(tanggal, hariIni)}</time>
            </li>
            {pesan.map((p) => (
              <BubblePesan
                key={p.id}
                pesan={p}
                onPutuskan={mengetik ? undefined : (keputusan) => putuskan(p.id, keputusan)}
              />
            ))}
          </Fragment>
        ))}
        {mengetik && <IndikatorMengetik />}
        <li ref={bawahRef} aria-hidden="true" />
      </ol>

      <form onSubmit={kirim} className="flex items-center gap-2 border-t bg-card/80 px-3 py-2.5">
        <label htmlFor="kosta-pesan" className="sr-only">
          Tulis pesan untuk Kosta
        </label>
        <input
          id="kosta-pesan"
          autoComplete="off"
          placeholder="Tanya Kosta…"
          className="h-11 min-w-0 flex-1 rounded-full border border-input bg-card px-4 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:text-sm"
          value={draf}
          onChange={(e) => setDraf(e.target.value)}
        />
        <button
          type="submit"
          aria-label="Kirim pesan"
          disabled={!draf.trim() || mengetik}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-opacity outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
        >
          <SendHorizontal className="size-5" />
        </button>
      </form>
    </section>
  );
}
