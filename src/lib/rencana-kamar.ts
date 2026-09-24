// Penomoran kamar otomatis untuk wizard Tambah kos & kamar.
// Setiap tipe punya kode awal (mis. "A") dan jumlah; nomor melanjutkan nomor terbesar yang
// sudah ada untuk kode itu (A01–A12 sudah ada → mulai A13), jadi tidak pernah bentrok.

export type RencanaTipe = {
  tipe: string;
  /** Kode awal nomor kamar, 1–3 huruf. */
  kode: string;
  jumlah: number;
  hargaSewa: number;
};

export type KamarBaru = { nomorKamar: string; tipe: string; hargaSewa: number };

export const MAKS_KAMAR_PER_TIPE = 200;

/** Galat per baris rencana (indeks sama dengan rencana); string kosong = baris valid. */
export function periksaRencana(rencana: RencanaTipe[]) {
  return rencana.map((r) => {
    if (!r.tipe.trim()) return "Isi nama tipe kamar.";
    if (!/^[A-Za-z]{1,3}$/.test(r.kode.trim())) return "Kode awal 1–3 huruf, mis. A.";
    if (!Number.isInteger(r.jumlah) || r.jumlah < 1 || r.jumlah > MAKS_KAMAR_PER_TIPE) {
      return `Jumlah kamar 1–${MAKS_KAMAR_PER_TIPE}.`;
    }
    if (!Number.isInteger(r.hargaSewa) || r.hargaSewa <= 0) return "Isi harga sewa per bulan.";
    return "";
  });
}

/** Nomor terbesar yang sudah dipakai untuk suatu kode, mis. ["A01","A12","B03"], "A" → 12. */
function nomorTerbesar(nomorAda: string[], kode: string) {
  let terbesar = 0;
  for (const nomor of nomorAda) {
    const cocok = new RegExp(`^${kode}(\\d+)$`, "i").exec(nomor);
    if (cocok) terbesar = Math.max(terbesar, Number(cocok[1]));
  }
  return terbesar;
}

/** Daftar kamar baru dari rencana yang valid, melanjutkan nomor yang sudah ada. */
export function buatDaftarKamar(rencana: RencanaTipe[], nomorAda: string[] = []): KamarBaru[] {
  const terpakai = [...nomorAda];
  const hasil: KamarBaru[] = [];
  for (const r of rencana) {
    const kode = r.kode.trim().toUpperCase();
    const mulai = nomorTerbesar(terpakai, kode) + 1;
    const akhir = mulai + r.jumlah - 1;
    const lebar = Math.max(2, String(akhir).length);
    for (let n = mulai; n <= akhir; n++) {
      const nomorKamar = `${kode}${String(n).padStart(lebar, "0")}`;
      hasil.push({ nomorKamar, tipe: r.tipe.trim(), hargaSewa: r.hargaSewa });
      terpakai.push(nomorKamar);
    }
  }
  return hasil;
}
