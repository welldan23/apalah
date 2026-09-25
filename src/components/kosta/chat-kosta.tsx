"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { ArrowLeftRight, History, SendHorizontal } from "lucide-react";

import { BubblePesan } from "@/components/kosta/bubble-pesan";
import { PanelRiwayat } from "@/components/kosta/panel-riwayat";
import { PemilihWorkspace } from "@/components/kosta/pemilih-workspace";
import { ActionSheet, kirimAksi } from "@/components/quick-actions/action-sheet";
import { statusSetelah } from "@/lib/draft-aksi";
import { tampilNomorWa } from "@/lib/nomor-wa";
import { labelHari, ringkasRiwayat, tanggalPesan } from "@/lib/riwayat-kosta";
import type { PesanKosta, StatusDraftAksi, WorkspaceRingkas } from "@/lib/types";

function IndikatorMengetik() {
  return (
    <li className="flex justify-start" aria-label="Kosta AI sedang mengetik">
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
  const [riwayatTerbuka, setRiwayatTerbuka] = useState(false);
  const aktif = workspaces.find((ws) => ws.id === aktifId) ?? workspaces[0];
  const [draf, setDraf] = useState("");
  const [mengetik, setMengetik] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);

  const pesanLokal = (dari: PesanKosta["dari"], teks: string): PesanKosta => ({
    id: crypto.randomUUID(),
    dari,
    waktu: new Date().toISOString(),
    teks,
  });
  const tambahPesan = (dari: PesanKosta["dari"], teks: string) => setPesan((p) => [...p, pesanLokal(dari, teks)]);

  /** Kirim ke server; selama menunggu tampil indikator mengetik. Galat jadi pesan Kosta. */
  async function keServer<T>(url: string, body: unknown, berhasil: (data: T) => void) {
    setMengetik(true);
    try {
      berhasil(await kirimAksi<T>(url, body));
    } catch (err) {
      tambahPesan("kosta", `Maaf, pesanmu belum terproses: ${(err as Error).message}`);
    } finally {
      setMengetik(false);
    }
  }

  const aturStatusDraft = (daftar: PesanKosta[], pesanId: string, status: StatusDraftAksi) =>
    daftar.map((m) =>
      m.id === pesanId && m.lampiran?.jenis === "preview_aksi" ? { ...m, lampiran: { ...m.lampiran, status } } : m,
    );

  /** Keputusan owner atas preview: dijalankan di server, lalu keputusan & balasan Kosta tercatat di riwayat. */
  async function putuskan(pesanId: string, keputusan: "setuju" | "batal") {
    const lampiran = pesan.find((m) => m.id === pesanId)?.lampiran;
    const statusBaru = lampiran?.jenis === "preview_aksi" ? statusSetelah(lampiran.status, keputusan) : null;
    if (lampiran?.jenis !== "preview_aksi" || !lampiran.draftId || !statusBaru || mengetik) return;

    setPesan((p) => aturStatusDraft(p, pesanId, statusBaru));
    setMengetik(true);
    try {
      const data = await kirimAksi<{ status: StatusDraftAksi; balasan: string; pesan: PesanKosta[] }>(
        `/api/kosta/draft/${lampiran.draftId}`,
        { keputusan },
      );
      const tambahan = data.pesan.length
        ? data.pesan
        : [pesanLokal("owner", keputusan === "batal" ? "Batal" : "Setuju"), pesanLokal("kosta", data.balasan)];
      setPesan((p) => [...aturStatusDraft(p, pesanId, data.status), ...tambahan]);
    } catch (err) {
      setPesan((p) => [
        ...aturStatusDraft(p, pesanId, lampiran.status),
        pesanLokal("kosta", `Maaf, keputusanmu belum tersimpan: ${(err as Error).message}`),
      ]);
    } finally {
      setMengetik(false);
    }
  }
  // Selalu tampilkan pesan terbaru (hanya area chat yang digulir, bukan halaman).
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [pesan.length, mengetik]);

  function kirim(e: React.FormEvent) {
    e.preventDefault();
    const teks = draf.trim();
    if (!teks || mengetik) return;
    const sementara = pesanLokal("owner", teks);
    setPesan((p) => [...p, sementara]);
    setDraf("");
    // Pesan owner & balasan Kosta tersimpan di riwayat server — ganti pesan sementara dengan versi server.
    void keServer<{ pesan: PesanKosta[] }>("/api/kosta/pesan", { teks }, (data) =>
      setPesan((p) => {
        // Preview baru menggantikan preview lama yang belum diputuskan (sama seperti di server).
        const adaPreviewBaru = data.pesan.some((m) => m.lampiran?.jenis === "preview_aksi");
        const lama = p
          .filter((m) => m.id !== sementara.id)
          .map((m) =>
            adaPreviewBaru && m.lampiran?.jenis === "preview_aksi" && m.lampiran.status === "menunggu_konfirmasi"
              ? { ...m, lampiran: { ...m.lampiran, status: "dibatalkan" as const } }
              : m,
          );
        return [...lama, ...data.pesan];
      }),
    );
  }

  function gantiKos(ws: WorkspaceRingkas) {
    setPilihKosTerbuka(false);
    if (ws.id === aktifId || mengetik) return;
    void keServer<{ pesan: PesanKosta }>("/api/kosta/workspace", { organizationId: ws.id }, (data) => {
      setAktifId(ws.id);
      setPesan((p) => [...p, data.pesan]);
    });
  }

  function lompatKe(tanggal: string) {
    setRiwayatTerbuka(false);
    const pemisah = document.getElementById(`kosta-${tanggal}`);
    listRef.current?.scrollTo({ top: (pemisah?.offsetTop ?? 0) - 8, behavior: "smooth" });
  }

  // Kelompokkan per tanggal WIB untuk pemisah "Hari ini" / tanggal.
  const grup: { tanggal: string; pesan: PesanKosta[] }[] = [];
  for (const p of pesan) {
    const tanggal = tanggalPesan(p);
    const terakhir = grup.at(-1);
    if (terakhir?.tanggal === tanggal) terakhir.pesan.push(p);
    else grup.push({ tanggal, pesan: [p] });
  }

  const riwayat = ringkasRiwayat(pesan);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_17rem]">
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
              Kosta AI
            </h2>
            <p className="truncate text-xs text-primary-foreground/75">
              {mengetik ? "mengetik…" : `${aktif.namaKos} · WhatsApp ${tampilNomorWa(nomorWa)}`}
            </p>
          </div>
          <button
            type="button"
            aria-label="Riwayat percakapan"
            aria-haspopup="dialog"
            onClick={() => setRiwayatTerbuka(true)}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-primary-foreground/10 outline-none hover:bg-primary-foreground/20 focus-visible:ring-3 focus-visible:ring-accent/40 lg:hidden"
          >
            <History className="size-5" aria-hidden="true" />
          </button>
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
          description="Kosta AI hanya membaca data kos yang dipilih."
        >
          <div className="overflow-y-auto p-4">
            <PemilihWorkspace workspaces={workspaces} aktifId={aktif.id} onPilih={gantiKos} />
          </div>
        </ActionSheet>

        <ActionSheet
          open={riwayatTerbuka}
          onOpenChange={setRiwayatTerbuka}
          title="Riwayat percakapan"
          description="Pilih hari untuk melihat percakapannya."
        >
          <PanelRiwayat
            riwayat={riwayat}
            hariIni={hariIni}
            onPilih={lompatKe}
            className="overflow-y-auto p-4"
          />
        </ActionSheet>

        <ol
          ref={listRef}
          aria-label="Percakapan dengan Kosta AI"
          aria-live="polite"
          className="relative flex flex-1 flex-col gap-2 overflow-y-auto px-3 py-4 sm:px-5"
        >
          {grup.map(({ tanggal, pesan }) => (
            <Fragment key={tanggal}>
              <li
                id={`kosta-${tanggal}`}
                className="my-1 self-center rounded-md bg-card/80 px-2 py-0.5 text-xs text-muted-foreground"
              >
                <time dateTime={tanggal}>{labelHari(tanggal, hariIni)}</time>
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
        </ol>

        <form onSubmit={kirim} className="flex items-center gap-2 border-t bg-card/80 px-3 py-2.5">
          <label htmlFor="kosta-pesan" className="sr-only">
            Tulis pesan untuk Kosta AI
          </label>
          <input
            id="kosta-pesan"
            autoComplete="off"
            placeholder="Tanya Kosta AI…"
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

      <aside aria-labelledby="riwayat-judul" className="hidden lg:flex lg:h-[calc(100dvh-11rem)] lg:flex-col">
        <h2 id="riwayat-judul" className="mb-2 text-sm font-semibold">
          Riwayat percakapan
        </h2>
        <PanelRiwayat riwayat={riwayat} hariIni={hariIni} onPilih={lompatKe} className="overflow-y-auto" />
      </aside>
    </div>
  );
}
