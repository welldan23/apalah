// Keterangan penghuni yang dipakai beberapa tampilan.

/** Lama tinggal antara dua tanggal "YYYY-MM-DD", mis. "2 tahun 3 bulan" / "5 bulan" / "< 1 bulan". */
export function lamaTinggal(masuk: string, keluar: string) {
  const [tm, bm, hm] = masuk.split("-").map(Number);
  const [tk, bk, hk] = keluar.split("-").map(Number);
  let bulan = (tk - tm) * 12 + (bk - bm) - (hk < hm ? 1 : 0);
  if (bulan < 1) return "< 1 bulan";
  const tahun = Math.floor(bulan / 12);
  bulan %= 12;
  return [tahun && `${tahun} tahun`, bulan && `${bulan} bulan`].filter(Boolean).join(" ");
}
