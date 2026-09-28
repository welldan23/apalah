import Link from "next/link";

import { CuplikanDashboard, IlustrasiJadwal, IlustrasiKamar, IlustrasiStatus } from "@/components/landing/ilustrasi";
import { Gelembung } from "@/components/landing/kosta-chat-mockup";
import { HREF_MULAI } from "@/components/landing/links";
import { SectionHeading } from "@/components/landing/section-heading";
import { Button } from "@/components/ui/button";
import { BENEFIT, CARA_KERJA, CHAT_KOSTA, CTA_TENGAH, MASALAH, PREVIEW_DASHBOARD } from "@/lib/landing/content";
import { cn } from "@/lib/utils";

// Narrative Workflow: halaman bercerita satu bulan di kos, tahap demi tahap. Isi tiap tahap diambil
// dari konten landing (cara kerja, fitur, "tanpa vs dengan Kostera", dashboard) — copy baru hanya
// judul seksi dan label waktu tiap tahap.

type Tahap = {
  waktu: string;
  judul: string;
  isi: string[];
  /** Kebiasaan lama yang diganti tahap ini, dan penggantinya. */
  dulu?: [string, string];
  hasil?: string;
  daftar?: string[];
  /** Perintah WhatsApp yang memicu tahap ini, ditampilkan sebagai pesan owner. */
  perintah?: string;
  visual?: React.ReactNode;
  /** Visual yang sudah punya latar sendiri (chat, dashboard) tidak diberi bingkai lagi. */
  tanpaBingkai?: boolean;
  lebar?: boolean;
};

/** Perintah chat pertama di deskripsi (teks di dalam “…”). */
const perintahChat = (deskripsi: string) => /“([^”]+)”/.exec(deskripsi)?.[1];

const [daftar, chat, kode] = CARA_KERJA;
const [jadwal, pantau, kamar] = BENEFIT;
const { sebelum, sesudah } = MASALAH;
const dulu = (i: number): [string, string] => [sebelum.poin[i], sesudah.poin[i]];

const TAHAP: Tahap[] = [
  { waktu: "Sekali di awal", judul: daftar.judul, isi: [daftar.deskripsi], hasil: daftar.hasil },
  {
    waktu: "Tanggal 1",
    judul: jadwal.judul,
    isi: [jadwal.deskripsi],
    dulu: dulu(0),
    perintah: perintahChat(jadwal.deskripsi),
    visual: <IlustrasiJadwal />,
  },
  {
    waktu: "Lewat jatuh tempo",
    judul: chat.judul,
    isi: [chat.deskripsi, kode.deskripsi],
    dulu: dulu(2),
    visual: (
      <ol className="flex flex-col gap-2 rounded-md bg-wa-wallpaper p-3">
        {CHAT_KOSTA.slice(3, 6).map((pesan, i) => (
          <Gelembung key={i} pesan={pesan} />
        ))}
      </ol>
    ),
    tanpaBingkai: true,
  },
  {
    waktu: "Saat penyewa bayar",
    judul: pantau.judul,
    isi: [pantau.deskripsi],
    dulu: dulu(1),
    perintah: perintahChat(pantau.deskripsi),
    visual: <IlustrasiStatus />,
  },
  {
    waktu: "Kapan saja",
    judul: kamar.judul,
    isi: [kamar.deskripsi],
    dulu: dulu(3),
    perintah: perintahChat(kamar.deskripsi),
    visual: <IlustrasiKamar />,
  },
  {
    waktu: "Akhir bulan",
    judul: PREVIEW_DASHBOARD.judul,
    isi: [PREVIEW_DASHBOARD.deskripsi],
    daftar: PREVIEW_DASHBOARD.sorotan,
    visual: <CuplikanDashboard />,
    tanpaBingkai: true,
    lebar: true,
  },
];

export function AlurSection() {
  return (
    <section id="cara-kerja" aria-labelledby="cara-kerja-judul" className="mx-auto max-w-6xl scroll-mt-6 px-4 pt-20 pb-16 sm:px-6 lg:pt-28">
      <SectionHeading
        id="cara-kerja-judul"
        judul="Satu bulan di kos, dari daftar sampai tutup buku"
        deskripsi="Kosta AI di WhatsApp untuk urusan harian, dashboard untuk melihat semuanya sekaligus."
      />

      <ol className="mt-14">
        {TAHAP.map((t, i) => (
          <li
            key={t.judul}
            className={cn(
              "grid gap-8 border-t-2 border-foreground py-10 md:gap-12 lg:py-14",
              t.visual && (t.lebar ? "lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]" : "md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]"),
            )}
          >
            <div>
              {/* Label tahap di atas judul (bertumpuk, bukan di samping). */}
              <p className="flex items-baseline gap-3 font-mono">
                <span className="text-4xl leading-none font-medium">{i + 1}.0</span>
                <span className="text-sm tracking-wide text-muted-foreground uppercase">{t.waktu}</span>
              </p>
              <h3 className="mt-5 text-2xl font-semibold tracking-[-0.015em] sm:text-3xl">{t.judul}</h3>
              {t.isi.map((p) => (
                <p key={p} className="mt-3 max-w-prose text-pretty text-muted-foreground">
                  {p}
                </p>
              ))}
              {t.dulu && (
                <dl className="mt-6 grid max-w-prose grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 border-t border-dashed pt-4 text-sm">
                  <dt className="font-mono text-xs leading-5 text-muted-foreground uppercase">Dulu</dt>
                  <dd className="text-muted-foreground">
                    <s className="decoration-muted-foreground/50">{t.dulu[0]}</s>
                  </dd>
                  <dt className="font-mono text-xs leading-5 text-primary uppercase">Sekarang</dt>
                  <dd className="font-medium">{t.dulu[1]}</dd>
                </dl>
              )}
              {t.hasil && <p className="mt-5 text-sm font-medium text-primary">→ {t.hasil}</p>}
              {t.daftar && (
                <ul className="mt-6 max-w-prose border-t">
                  {t.daftar.map((poin) => (
                    <li key={poin} className="border-b py-2.5">
                      {poin}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {t.visual && (
              <figure aria-hidden="true" className="flex min-w-0 flex-col gap-3 self-start">
                {t.perintah && (
                  <p className="bayangan-wa w-fit max-w-full self-end rounded-lg rounded-tr-none bg-wa-keluar px-2.5 py-1.5 text-sm text-wa-tinta">
                    {t.perintah}
                  </p>
                )}
                <div className={cn(!t.tanpaBingkai && "rounded-md border bg-card p-4")}>{t.visual}</div>
                {t.lebar && <figcaption className="text-xs text-muted-foreground">Data contoh, bukan data kos sungguhan.</figcaption>}
              </figure>
            )}
          </li>
        ))}
      </ol>

      <div id="cta-tengah" className="flex flex-col gap-5 border-t-2 border-foreground pt-10 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xl">
          <h2 id="cta-tengah-judul" className="text-2xl font-semibold tracking-[-0.015em]">
            {CTA_TENGAH.judul}
          </h2>
          <p className="mt-2 text-muted-foreground">{CTA_TENGAH.deskripsi}</p>
        </div>
        <Button asChild size="lg" className="h-12 shrink-0 rounded-md px-6 text-base whitespace-nowrap">
          <Link href={HREF_MULAI}>{CTA_TENGAH.tombol}</Link>
        </Button>
      </div>
    </section>
  );
}
