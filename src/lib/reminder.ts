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

/** Status tagihan yang boleh diingatkan: sudah dikirim ke penyewa dan belum dibayar. */
export const STATUS_BISA_DIINGATKAN = ["menunggu", "terkirim", "jatuh_tempo"] as const;

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

export const MAKS_JADWAL = 5;
export const MAKS_OFFSET_HARI = 14;
/** Jam kirim yang wajar untuk penyewa. */
export const JAM_KIRIM = { paling_awal: "06:00", paling_akhir: "21:00" } as const;

/**
 * Galat jadwal baru/ubahan terhadap daftar jadwal yang ada (string kosong = valid).
 * `indeksUbah` = posisi jadwal yang sedang diubah (dikecualikan dari cek bentrok).
 */
export function periksaJadwal(jadwal: JadwalPengingat, semua: JadwalPengingat[], indeksUbah?: number) {
  if (!Number.isInteger(jadwal.offsetHari) || Math.abs(jadwal.offsetHari) > MAKS_OFFSET_HARI) {
    return `Pilih 0–${MAKS_OFFSET_HARI} hari dari jatuh tempo.`;
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(jadwal.jam)) return "Isi jam kirim, mis. 09:00.";
  if (jadwal.jam < JAM_KIRIM.paling_awal || jadwal.jam > JAM_KIRIM.paling_akhir) {
    return "Jam kirim antara 06.00 dan 21.00 supaya tidak mengganggu penyewa.";
  }
  const lain = semua.filter((_, i) => i !== indeksUbah);
  if (lain.some((j) => j.offsetHari === jadwal.offsetHari)) {
    return `Sudah ada jadwal ${labelJadwal(jadwal.offsetHari)}. Ubah jadwal itu saja.`;
  }
  if (indeksUbah === undefined && semua.length >= MAKS_JADWAL) return `Maksimal ${MAKS_JADWAL} jadwal.`;
  return "";
}

/** Satu penyewa tidak diingatkan lebih dari sekali dalam rentang ini. */
export const JEDA_PENGINGAT_JAM = 24;

/** true bila tagihan boleh diingatkan lagi (belum pernah, atau terakhir ≥ 24 jam lalu). */
export function bolehDiingatkan(terakhirDiingatkan: string | undefined, sekarang: Date) {
  if (!terakhirDiingatkan) return true;
  return sekarang.getTime() - new Date(terakhirDiingatkan).getTime() >= JEDA_PENGINGAT_JAM * 3_600_000;
}

export const STATUS_RIWAYAT = ["semua", "terkirim", "gagal"] as const;
export type StatusRiwayat = (typeof STATUS_RIWAYAT)[number];

/** Nilai status dari URL; selain "terkirim"/"gagal" dianggap "semua". */
export const parseStatusRiwayat = (nilai: string | null): StatusRiwayat =>
  nilai === "terkirim" || nilai === "gagal" ? nilai : "semua";

/** Posisi jenis di pilihan filter: Manual dulu, lalu H-x → H → H+x, jenis lain di akhir. */
function posisiJenis(jenis: string) {
  if (jenis === "manual") return -Infinity;
  const cocok = /^H([+-]\d+)?$/.exec(jenis);
  return cocok ? Number(cocok[1] ?? 0) : Infinity;
}

/** Jenis unik yang ada di riwayat, urut untuk pilihan filter. */
export const jenisDiRiwayat = (riwayat: { jenis: string }[]) =>
  [...new Set(riwayat.map((r) => r.jenis))].sort((a, b) => posisiJenis(a) - posisiJenis(b) || a.localeCompare(b));

/** Periode tagihan unik yang ada di riwayat, terbaru dulu. */
export const periodeDiRiwayat = (riwayat: { periode: string }[]) =>
  [...new Set(riwayat.map((r) => r.periode))].sort((a, b) => b.localeCompare(a));

export type FilterRiwayat = {
  status: StatusRiwayat;
  /** "" = semua jenis. */
  jenis: string;
  /** Periode tagihan YYYY-MM; "" = semua. */
  tagihan: string;
  cari: string;
};

/** Saring riwayat pengingat per status, jenis, periode tagihan, dan kata kunci nama penghuni / nomor kamar. */
export function saringRiwayatReminder<
  T extends { status: string; jenis: string; periode: string; namaPenghuni: string; nomorKamar: string },
>(riwayat: T[], { status, jenis, tagihan, cari }: FilterRiwayat) {
  const kunci = cari.trim().toLowerCase();
  return riwayat.filter(
    (r) =>
      (status === "semua" || r.status === status) &&
      (!jenis || r.jenis === jenis) &&
      (!tagihan || r.periode === tagihan) &&
      (!kunci || r.namaPenghuni.toLowerCase().includes(kunci) || r.nomorKamar.toLowerCase().includes(kunci)),
  );
}
