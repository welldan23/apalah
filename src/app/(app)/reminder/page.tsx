import type { Metadata } from "next";

import { AntrianReminder } from "@/components/reminder/antrian-reminder";
import { KartuJadwal } from "@/components/reminder/kartu-jadwal";
import { PerluDiingatkan } from "@/components/reminder/perlu-diingatkan";
import { RingkasanReminder } from "@/components/reminder/ringkasan-reminder";
import { RiwayatReminderTerbaru } from "@/components/reminder/riwayat-reminder";
import { getHalamanReminder } from "@/lib/data/halaman-reminder";

export const metadata: Metadata = {
  title: "Reminder Otomatis",
};

export default async function ReminderPage() {
  const data = await getHalamanReminder();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 lg:gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Reminder Otomatis</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pengingat bayar ke penyewa {data.namaKos} — terjadwal otomatis atau dikirim manual setelah kamu cek.
        </p>
      </header>

      <RingkasanReminder statistik={data.statistik} menunggak={data.menunggak} periode={data.periode} />

      <div className="grid items-start gap-5 lg:grid-cols-3 lg:gap-6">
        <div className="flex min-w-0 flex-col gap-5 lg:col-span-2 lg:gap-6">
          <PerluDiingatkan menunggak={data.menunggak} hariIni={data.hariIni} periode={data.periode} namaKos={data.namaKos} />
          <RiwayatReminderTerbaru riwayat={data.riwayat} />
        </div>
        <div className="flex min-w-0 flex-col gap-5 lg:gap-6">
          <KartuJadwal jadwal={data.jadwal} otomatisAktif={data.otomatisAktif} />
          <AntrianReminder antrian={data.antrian} hariIni={data.hariIni} otomatisAktif={data.otomatisAktif} />
        </div>
      </div>
    </div>
  );
}
