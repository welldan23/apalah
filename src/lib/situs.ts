// Alamat publik situs Kostera (untuk metadata, sitemap, dan link absolut).

export function urlSitus() {
  return process.env.APP_URL ?? "https://kostera.id";
}

/** Rute yang tidak untuk diindeks mesin pencari: aplikasi (butuh login), API, dan link invoice pribadi. */
export const RUTE_PRIVAT = ["/dashboard", "/tagihan", "/api/", "/invoice/"];
