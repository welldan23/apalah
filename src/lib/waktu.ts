// Waktu kalender Kostera selalu mengikuti WIB (Asia/Jakarta), bukan zona waktu server.

const tanggalWibFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const jamWibFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Jakarta",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Date → jam WIB "HH:MM". */
export function jamWib(waktu: Date) {
  return jamWibFormat.format(waktu);
}

/** Date → tanggal kalender WIB "YYYY-MM-DD". */
export function tanggalWib(waktu: Date) {
  return tanggalWibFormat.format(waktu);
}

/** Hari ini menurut WIB, "YYYY-MM-DD". */
export function hariIniWib(sekarang = new Date()) {
  return tanggalWib(sekarang);
}

/** Periode berjalan menurut WIB, "YYYY-MM". */
export function periodeWib(sekarang = new Date()) {
  return hariIniWib(sekarang).slice(0, 7);
}

/** Validasi format periode "YYYY-MM". */
export function periodeValid(periode: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(periode);
}
