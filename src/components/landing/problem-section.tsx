import { SectionHeading } from "@/components/landing/section-heading";
import { MASALAH } from "@/lib/landing/content";

/** Kebiasaan lama vs. yang dikerjakan Kostera, dipasangkan per baris (poin ke-n ↔ poin ke-n). */
export function ProblemSection() {
  const { sebelum, sesudah } = MASALAH;
  return (
    <section aria-labelledby="masalah-judul" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <SectionHeading id="masalah-judul" judul={MASALAH.judul} />
      <table className="mt-10 w-full border-collapse text-left">
        <caption className="sr-only">
          {sebelum.label} dibandingkan {sesudah.label}
        </caption>
        <thead className="hidden sm:table-header-group">
          <tr className="border-b-2 border-foreground text-sm">
            <th scope="col" className="w-1/2 py-3 pr-6 font-medium text-muted-foreground">
              {sebelum.label}
            </th>
            <th scope="col" className="w-1/2 py-3 font-semibold">
              {sesudah.label}
            </th>
          </tr>
        </thead>
        <tbody>
          {sebelum.poin.map((lama, i) => (
            <tr key={lama} className="flex flex-col border-b py-4 sm:table-row sm:py-0">
              <td className="text-muted-foreground sm:py-5 sm:pr-6 sm:align-top">
                <span className="mb-1 block text-xs font-medium tracking-wide text-muted-foreground/80 uppercase sm:hidden">
                  {sebelum.label}
                </span>
                <s className="decoration-muted-foreground/50">{lama}</s>
              </td>
              <td className="mt-3 sm:mt-0 sm:py-5 sm:align-top">
                <span className="mb-1 block text-xs font-medium tracking-wide text-primary uppercase sm:hidden">
                  {sesudah.label}
                </span>
                {sesudah.poin[i]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
