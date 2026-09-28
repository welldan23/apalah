import type { HalamanReminder } from "@/lib/data/halaman-reminder";
import { formatPeriode, formatRupiahSingkat } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Angka pengingat bulan ini + tagihan yang masih menunggak. */
export function RingkasanReminder({ statistik, menunggak, periode }: Pick<HalamanReminder, "statistik" | "menunggak" | "periode">) {
  const nominalMenunggak = menunggak.reduce((total, t) => total + t.nominal, 0);
  const kartu = [
    { label: "Terkirim", nilai: statistik.terkirim, catatan: formatPeriode(periode), perhatian: false },
    { label: "Gagal terkirim", nilai: statistik.gagal, catatan: "cek nomor WhatsApp", perhatian: statistik.gagal > 0 },
    { label: "Penyewa diingatkan", nilai: statistik.penyewa, catatan: "bulan ini", perhatian: false },
    { label: "Masih menunggak", nilai: menunggak.length, catatan: formatRupiahSingkat(nominalMenunggak), perhatian: menunggak.length > 0 },
  ];
  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-lg border bg-card lg:grid-cols-4">
      {kartu.map(({ label, nilai, catatan, perhatian }, i) => (
        <div
          key={label}
          className={cn(
            "flex flex-col gap-1 p-4",
            i % 2 === 1 && "border-l",
            i >= 2 && "border-t lg:border-t-0",
            i === 2 && "lg:border-l",
            perhatian && "bg-warning-soft/60",
          )}
        >
          <dt className="text-sm text-muted-foreground">{label}</dt>
          <dd className="text-3xl font-semibold tracking-[-0.02em]">{nilai}</dd>
          <dd className="text-xs text-muted-foreground tabular-nums">{catatan}</dd>
        </div>
      ))}
    </dl>
  );
}
