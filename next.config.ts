import type { NextConfig } from "next";

import { aturanDomain } from "./src/lib/rute-domain";

const nextConfig: NextConfig = {
  // PGlite memuat file WASM sendiri; jangan dibundel Next.
  serverExternalPackages: ["@electric-sql/pglite"],
  // kostera.id = landing, app.kostera.id = aplikasi (aktif bila LANDING_URL & APP_URL diisi).
  async redirects() {
    return aturanDomain(process.env);
  },
  // Dashboard punya aksi satu-klik (kirim tagihan/pengingat): larang dimuat di iframe situs lain.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
