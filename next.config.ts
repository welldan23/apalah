import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite memuat file WASM sendiri; jangan dibundel Next.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
