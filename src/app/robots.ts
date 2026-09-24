import type { MetadataRoute } from "next";

import { RUTE_PRIVAT, urlSitus } from "@/lib/situs";

// Landing boleh diindeks; halaman aplikasi & API tidak.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: RUTE_PRIVAT },
    sitemap: `${urlSitus()}/sitemap.xml`,
  };
}
