import type { MetadataRoute } from "next";

import { urlLanding, urlSitus } from "@/lib/situs";

// Hanya halaman publik tanpa login.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${urlLanding()}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${urlSitus()}/daftar`, changeFrequency: "yearly", priority: 0.8 },
  ];
}
