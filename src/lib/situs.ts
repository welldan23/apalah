// Alamat publik situs Kostera (untuk metadata, sitemap, dan link absolut).

export function urlSitus() {
  return process.env.APP_URL ?? "https://kostera.id";
}

/** Alamat landing (mis. https://kostera.id); sama dengan alamat aplikasi bila LANDING_URL kosong. */
export function urlLanding() {
  return process.env.LANDING_URL || urlSitus();
}

/** Rute yang tidak untuk diindeks mesin pencari: aplikasi (butuh login), API, dan link invoice pribadi. */
export const RUTE_PRIVAT = ["/dashboard", "/tagihan", "/api/", "/invoice/", "/platform"];
