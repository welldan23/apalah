// Alamat publik situs Kostera (untuk metadata, sitemap, dan link absolut).

export function urlSitus() {
  return process.env.APP_URL ?? "https://kostera.id";
}

/** Rute yang butuh login — tidak untuk diindeks mesin pencari. */
export const RUTE_PRIVAT = ["/dashboard", "/api/"];
