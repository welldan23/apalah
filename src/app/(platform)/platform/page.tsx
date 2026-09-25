import type { Metadata } from "next";
import { connection } from "next/server";
import { AlertTriangle, CircleCheck, CircleHelp } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { Card } from "@/components/ui/card";
import { getDb } from "@/db";
import { pastikanPlatformAdmin } from "@/lib/data/platform";
import { formatWaktu } from "@/lib/format";
import { getMetrikPlatform } from "@/lib/platform/konsol";

export const metadata: Metadata = { title: "Ringkasan" };

const waktu = (d: Date | null) => (d ? formatWaktu(d.toISOString()) : "—");

function Angka({ label, nilai, catatan }: { label: string; nilai: string | number; catatan?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-muted/50 px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xl font-semibold tabular-nums">{nilai}</span>
      {catatan && <span className="text-xs text-muted-foreground">{catatan}</span>}
    </div>
  );
}

function Bagian({ judul, children }: { judul: string; children: React.ReactNode }) {
  return (
    <Card className="gap-3 p-4 shadow-none">
      <h2 className="font-semibold">{judul}</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{children}</div>
    </Card>
  );
}

/** Master dashboard platform: metrik lintas workspace tanpa data penyewa. */
export default async function RingkasanPlatformPage() {
  await connection();
  await pastikanPlatformAdmin();
  const m = await getMetrikPlatform(await getDb());
  const sehat = m.kesehatan === "sehat";

  return (
    <>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Ringkasan platform</h1>
        <p className="mt-1 text-sm text-muted-foreground">Angka agregat lintas workspace (24 jam terakhir bila tidak disebut). Tanpa data penyewa.</p>
      </header>

      {m.provider.provider !== "meta" && (
        <p className="flex items-start gap-2 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          WhatsApp berjalan dalam mode {m.provider.mode}. WAHA hanya untuk pilot/sandbox internal — bukan jalur tagihan produksi.
        </p>
      )}

      <Bagian judul="Workspace">
        <Angka label="Total workspace" nilai={m.workspace.total} />
        <Angka label="Owner aktif" nilai={m.workspace.pemilikAktif} />
        <Angka label="Pakai Kosta AI (30 hari)" nilai={m.workspace.pakaiKosta30Hari} />
        <Angka label="Pilot disuspend" nilai={m.workspace.pilotDisuspend} />
      </Bagian>

      <Card className="gap-3 p-4 shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Provider WhatsApp & AI</h2>
          <StatusBadge tone={sehat ? "success" : m.kesehatan === "perlu dicek" ? "danger" : "neutral"} icon={sehat ? CircleCheck : m.kesehatan === "perlu dicek" ? AlertTriangle : CircleHelp}>
            {m.kesehatan}
          </StatusBadge>
        </div>
        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {(
            [
              ["Mode", m.provider.mode],
              [
                "Nomor uji (allowlist)",
                m.provider.nomorUji
                  ? `${m.provider.nomorUji} nomor`
                  : m.provider.kirimDitahan
                    ? "kosong — semua kiriman WAHA ditahan"
                    : "tidak dibatasi",
              ],
              ["Rahasia webhook", m.provider.rahasiaWebhook ? "terpasang" : "BELUM terpasang"],
              ["Token verifikasi Meta", m.provider.tokenVerifikasiMeta ? "terpasang" : "tidak dipakai"],
              ["Parser LLM", m.provider.llmAktif ? `aktif (${m.provider.modelLlm})` : "nonaktif — kata kunci saja"],
              ["Kiriman sukses terakhir", waktu(m.kirim24Jam.suksesTerakhir)],
            ] as const
          ).map(([label, nilai]) => (
            <div key={label} className="flex justify-between gap-3 border-b py-1.5">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-right font-medium">{nilai}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Bagian judul="Webhook WhatsApp masuk (24 jam)">
        <Angka label="Diterima" nilai={m.webhook24Jam.diterima} />
        <Angka label="Ditolak / galat" nilai={m.webhook24Jam.galat} catatan={`terakhir ${waktu(m.webhook24Jam.galatTerakhir)}`} />
        <Angka label="Pesan duplikat" nilai={m.webhook24Jam.duplikat} catatan="kiriman ulang provider" />
        <Angka label="Tanda tangan salah" nilai={m.webhook24Jam.perStatus.tanda_tangan_invalid ?? 0} />
      </Bagian>

      <Bagian judul="Pesan keluar & Kosta AI (24 jam)">
        <Angka label="WA terkirim" nilai={m.kirim24Jam.terkirim} />
        <Angka label="WA gagal" nilai={m.kirim24Jam.gagal} catatan={`${Math.round(m.kirim24Jam.rasioGagal * 100)}% gagal`} />
        <Angka label="Perintah Kosta AI dijawab" nilai={m.kosta24Jam.dijawab ?? 0} />
        <Angka label="Kosta AI ditolak / galat" nilai={(m.kosta24Jam.ditolak ?? 0) + (m.kosta24Jam.galat ?? 0)} />
      </Bagian>

      <Bagian judul="Aksi Kosta AI">
        <Angka label="Menunggu konfirmasi" nilai={m.aksi.menungguKonfirmasi} />
        <Angka label="Kedaluwarsa belum dibersihkan" nilai={m.aksi.kedaluwarsaBelumDibersihkan} catatan="dibersihkan cron harian" />
        <Angka label="Dijalankan (24 jam)" nilai={m.kosta24Jam.dijalankan ?? 0} />
        <Angka label="Dibatalkan (24 jam)" nilai={m.kosta24Jam.dibatalkan ?? 0} />
      </Bagian>
    </>
  );
}
