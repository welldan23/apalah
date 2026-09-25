import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite memuat file WASM sendiri; jangan dibundel Next.
  serverExternalPackages: ["@electric-sql/pglite"],
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
