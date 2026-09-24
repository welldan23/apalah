// Aturan pengingat bayar otomatis — fungsi murni, dipakai halaman Reminder dan penjadwal.
// Jadwal dinyatakan relatif terhadap jatuh tempo: offset -3 = H-3, 0 = hari H, +3 = H+3.

export type JadwalPengingat = {
  /** Hari relatif terhadap jatuh tempo (negatif = sebelum). */
  offsetHari: number;
  /** Jam kirim WIB "HH:MM". */
  jam: string;
  aktif: boolean;
};

export const JADWAL_BAWAAN: JadwalPengingat[] = [
  { offsetHari: -3, jam: "09:00", aktif: true },
  { offsetHari: 0, jam: "09:00", aktif: true },
  { offsetHari: 3, jam: "09:00", aktif: true },
];

/** Jenis pesan di tabel reminders yang BUKAN pengingat bayar. */
export const JENIS_BUKAN_PENGINGAT = ["tagihan", "konfirmasi_lunas"] as const;

/** -3 → "H-3", 0 → "H", 3 → "H+3". */
export const labelJadwal = (offsetHari: number) =>
  offsetHari === 0 ? "H" : offsetHari < 0 ? `H${offsetHari}` : `H+${offsetHari}`;

/** Kalimat untuk owner: "3 hari sebelum jatuh tempo". */
export function keteranganJadwal(offsetHari: number) {
  if (offsetHari === 0) return "Di hari jatuh tempo";
  return `${Math.abs(offsetHari)} hari ${offsetHari < 0 ? "sebelum" : "setelah"} jatuh tempo`;
}

/** Label jenis di riwayat: "manual" → "Manual", "H-3" tetap. */
export const labelJenisReminder = (jenis: string) => (jenis === "manual" ? "Manual" : jenis);

const geserHari = (tanggal: string, hari: number) => {
  const d = new Date(`${tanggal}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + hari);
  return d.toISOString().slice(0, 10);
};

export type AntrianPengingat = {
  tanggal: string;
  jenis: string;
  jam: string;
  jumlah: number;
  nominal: number;
};

/**
 * Pengingat yang akan terkirim dalam `hari` ke depan (mulai hari ini) menurut jadwal aktif,
 * untuk tagihan yang belum dibayar. Dikelompokkan per tanggal & jenis.
 */
export function antrianPengingat(
  tagihan: { jatuhTempo: string; nominal: number; status: string }[],
  jadwal: JadwalPengingat[],
  hariIni: string,
  hari = 7,
): AntrianPengingat[] {
  const batas = geserHari(hariIni, hari);
  const grup = new Map<string, AntrianPengingat & { offset: number }>();
  for (const t of tagihan) {
    if (!["menunggu", "terkirim", "jatuh_tempo"].includes(t.status)) continue;
    for (const j of jadwal) {
      if (!j.aktif) continue;
      const tanggal = geserHari(t.jatuhTempo, j.offsetHari);
      if (tanggal < hariIni || tanggal >= batas) continue;
      const kunci = `${tanggal}|${j.offsetHari}`;
      const g = grup.get(kunci) ?? { tanggal, jenis: labelJadwal(j.offsetHari), jam: j.jam, jumlah: 0, nominal: 0, offset: j.offsetHari };
      g.jumlah += 1;
      g.nominal += t.nominal;
      grup.set(kunci, g);
    }
  }
  return [...grup.values()]
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.offset - b.offset)
    .map(({ tanggal, jenis, jam, jumlah, nominal }) => ({ tanggal, jenis, jam, jumlah, nominal }));
}
