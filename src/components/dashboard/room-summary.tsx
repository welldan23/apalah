import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatRupiahSingkat } from "@/lib/format";
import type { DashboardData, RoomCell } from "@/lib/types";
import { cn } from "@/lib/utils";

function KotakKamar({ kamar }: { kamar: RoomCell }) {
  const kosong = kamar.status === "kosong";
  const keterangan = kosong ? "kosong" : kamar.namaPenghuni ?? "terisi";

  return (
    <li
      title={`${kamar.nomorKamar} · ${keterangan}`}
      className={cn(
        "grid h-7 place-items-center rounded-md text-[0.65rem] font-semibold tabular-nums",
        kosong
          ? "border border-dashed border-warning/60 bg-warning-soft text-warning"
          : "bg-accent text-accent-foreground",
      )}
    >
      {kamar.nomorKamar}
      <span className="sr-only">, {keterangan}</span>
    </li>
  );
}

/** Ringkasan Kos & Kamar: hunian total plus peta kamar per tipe dalam satu pandangan. */
export function RoomSummary({
  namaKos,
  kamar,
}: {
  namaKos: string;
  kamar: DashboardData["kamar"];
}) {
  const persenTerisi = Math.round((kamar.terisi / kamar.total) * 100);
  const kosong = kamar.daftar.filter((k) => k.status === "kosong");

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>Kos &amp; kamar</CardTitle>
        <CardDescription>
          {namaKos} · {kamar.total} kamar
        </CardDescription>
      </CardHeader>

      <CardContent className="@container flex flex-col gap-5">
        <div>
          <dl className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-xs text-muted-foreground">Terisi</dt>
              <dd className="text-2xl font-semibold tabular-nums">
                {kamar.terisi}
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  {persenTerisi}%
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Kosong</dt>
              <dd className="text-2xl font-semibold tabular-nums">
                {kamar.kosong}
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  {100 - persenTerisi}%
                </span>
              </dd>
            </div>
          </dl>
          <Progress
            value={persenTerisi}
            aria-label={`Hunian ${persenTerisi}%`}
            className="mt-3 h-2 bg-warning-soft"
          />
        </div>

        <div className="flex flex-col gap-4">
          {kamar.perTipe.map((tipe) => (
            <section key={tipe.tipe} aria-label={`Kamar tipe ${tipe.tipe}`}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">
                  <span className="font-medium">{tipe.tipe}</span>{" "}
                  <span className="text-muted-foreground">
                    · {formatRupiahSingkat(tipe.hargaSewa)}/bln
                  </span>
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  <span className="font-medium text-foreground">{tipe.terisi}</span>/
                  {tipe.total} terisi
                </span>
              </div>
              <ul className="grid grid-cols-8 gap-1 @md:grid-cols-12 @2xl:grid-cols-16">
                {kamar.daftar
                  .filter((k) => k.tipe === tipe.tipe)
                  .map((k) => (
                    <KotakKamar key={k.id} kamar={k} />
                  ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="flex flex-col gap-2 border-t pt-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-3 rounded-sm bg-accent" />
              Terisi
            </span>
            <span className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="size-3 rounded-sm border border-dashed border-warning/60 bg-warning-soft"
              />
              Kosong
            </span>
          </div>
          {kosong.length > 0 && (
            <p>
              <span className="font-medium text-foreground">Siap ditawarkan:</span>{" "}
              {kosong.map((k) => k.nomorKamar).join(", ")}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
