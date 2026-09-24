import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { HalamanReminder } from "@/lib/data/halaman-reminder";
import { formatRupiah, selisihHari } from "@/lib/format";

const hariPendek = new Intl.DateTimeFormat("id-ID", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

function labelTanggal(tanggal: string, hariIni: string) {
  const selisih = selisihHari(hariIni, tanggal);
  if (selisih === 0) return "Hari ini";
  if (selisih === 1) return "Besok";
  return hariPendek.format(new Date(`${tanggal}T00:00:00Z`));
}

/** Satu baris per hari: jumlah & nominal total, plus rincian per jenis (H-3/H/H+3). */
function perHari(antrian: HalamanReminder["antrian"]) {
  const hari = new Map<string, { tanggal: string; jam: string; jumlah: number; nominal: number; jenis: { jenis: string; jumlah: number }[] }>();
  for (const a of antrian) {
    const h = hari.get(a.tanggal) ?? { tanggal: a.tanggal, jam: a.jam, jumlah: 0, nominal: 0, jenis: [] };
    h.jumlah += a.jumlah;
    h.nominal += a.nominal;
    h.jenis.push({ jenis: a.jenis, jumlah: a.jumlah });
    hari.set(a.tanggal, h);
  }
  return [...hari.values()];
}

/** Pengingat otomatis yang akan terkirim dalam 7 hari ke depan. */
export function AntrianReminder({ antrian, hariIni, otomatisAktif }: Pick<HalamanReminder, "antrian" | "hariIni" | "otomatisAktif">) {
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>7 hari ke depan</CardTitle>
        <CardDescription>
          {otomatisAktif ? "Pengingat yang akan terkirim otomatis." : "Akan terkirim bila jadwal otomatis diaktifkan."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {antrian.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
            Tidak ada pengingat terjadwal minggu ini.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {perHari(antrian).map((h) => (
              <li key={h.tanggal} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {labelTanggal(h.tanggal, hariIni)}{" "}
                    <span className="font-normal text-muted-foreground">· {h.jam.replace(":", ".")}</span>
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {h.jumlah} pengingat · {formatRupiah(h.nominal)}
                  </p>
                </div>
                <span className="flex shrink-0 flex-wrap justify-end gap-1">
                  {h.jenis.map((j) => (
                    <span key={j.jenis} className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-semibold tabular-nums">
                      {j.jenis}
                      <span className="ml-1 font-normal text-muted-foreground">{j.jumlah}</span>
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
