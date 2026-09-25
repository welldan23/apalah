// Kode aksi 6 digit untuk konfirmasi preview Kosta lewat chat ("YA 482913"). Diturunkan dari
// action_drafts.id (hash FNV-1a), jadi owner selalu menyetujui aksi tertentu — bukan "yang terakhir".
// Kode hanya dicocokkan dengan draft di percakapan & kos yang sama; ini penanda, bukan rahasia.

export function kodeAksi(actionId: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < actionId.length; i++) {
    h ^= actionId.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return String(h % 1_000_000).padStart(6, "0");
}
