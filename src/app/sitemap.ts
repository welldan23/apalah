import type { MetadataRoute } from "next";

import { urlSitus } from "@/lib/situs";

// Hanya halaman publik tanpa login.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${urlSitus()}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${urlSitus()}/daftar`, changeFrequency: "yearly", priority: 0.8 },
  ];
}
