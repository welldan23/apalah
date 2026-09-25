// Pembagian domain produksi: LANDING_URL (mis. https://kostera.id) hanya untuk landing, APP_URL
// (mis. https://app.kostera.id) untuk aplikasi. Dipakai next.config.ts `redirects()` — dihitung saat
// build, jadi perubahan env ini butuh deploy ulang. Tanpa LANDING_URL (lokal, *.vercel.app) semua
// tetap di satu domain seperti biasa.

type Env = Partial<Record<string, string>>;

export type AturanRedirect = {
  source: string;
  destination: string;
  permanent: boolean;
  has?: { type: "host"; value: string }[];
};

const urlAtauNull = (nilai: string | undefined) => {
  try {
    return nilai ? new URL(nilai) : null;
  } catch {
    return null;
  }
};

/** Nilai `has.host` dicocokkan Next sebagai regex utuh (^…$) — titik harus di-escape. */
const polaHost = (host: string) => host.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Yang tetap dilayani di domain landing: aset build, API konten landing, dan berkas situs. */
const TETAP_DI_LANDING = "_next/|api/landing/|favicon\\.ico$|robots\\.txt$|sitemap\\.xml$";

export function aturanDomain(env: Env): AturanRedirect[] {
  // Link aplikasi lama (app.kostera.id/app/#/login) tetap sampai ke halaman masuk.
  const aturan: AturanRedirect[] = [{ source: "/app/:path*", destination: "/masuk", permanent: false }];
  const app = urlAtauNull(env.APP_URL);
  const landing = urlAtauNull(env.LANDING_URL);
  if (!app || !landing || app.hostname === landing.hostname) return aturan;

  aturan.push(
    // Domain aplikasi: beranda langsung ke dashboard (yang belum masuk diarahkan ke /masuk).
    { source: "/", has: [{ type: "host", value: polaHost(app.hostname) }], destination: "/dashboard", permanent: false },
    // Domain landing: selain beranda & asetnya, semua halaman aplikasi pindah ke domain aplikasi.
    {
      source: `/:path((?!${TETAP_DI_LANDING}).+)`,
      has: [{ type: "host", value: polaHost(landing.hostname) }],
      destination: `${app.origin}/:path`,
      permanent: false,
    },
  );
  return aturan;
}
