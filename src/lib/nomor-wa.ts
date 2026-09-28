// Nomor WhatsApp Indonesia disimpan dalam format internasional tanpa "+": 6281234567890.

/** "0812-3456 7890" / "+62 812…" → "6281234567890"; null bila tidak valid. */
export function normalisasiNomorWa(input: string) {
  const digit = input.replace(/\D/g, "");
  const nomor = digit.startsWith("0") ? `62${digit.slice(1)}` : digit;
  return /^628\d{7,12}$/.test(nomor) ? nomor : null;
}

/** "6281234567890" → "+62 812-3456-7890" */
export function tampilNomorWa(nomor: string) {
  return `+${nomor.slice(0, 2)} ${nomor.slice(2, 5)}-${nomor.slice(5, 9)}-${nomor.slice(9)}`;
}
