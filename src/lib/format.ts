// Format angka & tanggal gaya Indonesia. Tanggal ISO diperlakukan sebagai
// tanggal kalender (UTC) supaya tidak bergeser karena zona waktu.

const angka = new Intl.NumberFormat("id-ID");

/** 12500000 → "12.500.000" */
export function formatAngka(nilai: number) {
  return angka.format(nilai);
}

/** 12500000 → "Rp12.500.000", -500000 → "-Rp500.000" */
export function formatRupiah(nominal: number) {
  const tanda = nominal < 0 ? "-" : "";
  return `${tanda}Rp${angka.format(Math.abs(nominal))}`;
}

const desimal = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });

const SATUAN = [
  { besar: 1_000_000_000, akhiran: "M" },
  { besar: 1_000_000, akhiran: "jt" },
  { besar: 1_000, akhiran: "rb" },
] as const;

/** 12500000 → "Rp12,5jt", 800000 → "Rp800rb", 999999 → "Rp1jt" */
export function formatRupiahSingkat(nominal: number) {
  const tanda = nominal < 0 ? "-" : "";
  const nilai = Math.abs(nominal);
  // Satuan dipilih setelah pembulatan 2 desimal, supaya 999.999 jadi "Rp1jt", bukan "Rp1.000rb".
  for (const { besar, akhiran } of SATUAN) {
    const dibulatkan = Math.round((nilai / besar) * 100) / 100;
    if (dibulatkan >= 1) return `${tanda}Rp${desimal.format(dibulatkan)}${akhiran}`;
  }
  return formatRupiah(nominal);
}

function keTanggal(iso: string) {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`);
}

const tanggalPanjang = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const tanggalPendek = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const namaHari = new Intl.DateTimeFormat("id-ID", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const namaPeriode = new Intl.DateTimeFormat("id-ID", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** "2026-09-24" → "24 Sep 2026" */
export function formatTanggal(iso: string) {
  return tanggalPanjang.format(keTanggal(iso));
}

/** "2026-09-24" → "24 Sep" */
export function formatTanggalPendek(iso: string) {
  return tanggalPendek.format(keTanggal(iso));
}

/** "2026-09-24" → "Kamis, 24 September 2026" */
export function formatHari(iso: string) {
  return namaHari.format(keTanggal(iso));
}

/** "2026-09" → "September 2026" */
export function formatPeriode(periode: string) {
  return namaPeriode.format(keTanggal(`${periode}-01`));
}

/** Selisih hari kalender b − a. */
export function selisihHari(a: string, b: string) {
  return Math.round(
    (keTanggal(b).getTime() - keTanggal(a).getTime()) / 86_400_000,
  );
}

const waktuWib = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jakarta",
});

/** "2026-09-20T14:32:00+07:00" → "20 Sep, 14.32" (WIB) */
export function formatWaktu(isoDateTime: string) {
  return waktuWib.format(new Date(isoDateTime));
}

/** "2026-09" → "2026-10" */
export function periodeBerikutnya(periode: string) {
  const [tahun, bulan] = periode.split("-").map(Number);
  const d = new Date(Date.UTC(tahun, bulan, 1));
  return d.toISOString().slice(0, 7);
}

/** "2026-09" → "2026-08" */
export function periodeSebelumnya(periode: string) {
  const [tahun, bulan] = periode.split("-").map(Number);
  const d = new Date(Date.UTC(tahun, bulan - 2, 1));
  return d.toISOString().slice(0, 7);
}
