import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { urlSitus } from "@/lib/situs";

import "./globals.css";

// Plex Sans untuk teks; Plex Mono untuk kode & angka yang disalin/dicocokkan (kamar, VA, kode aksi).
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL(urlSitus()),
  title: {
    default: "Kostera — Kelola kos lebih rapi",
    template: "%s · Kostera",
  },
  description:
    "Tagihan kos rapi, pembayaran lebih pasti. Dashboard, tagihan, dan pemantauan pembayaran kos dalam satu tempat.",
};

export const viewport: Viewport = {
  themeColor: "#1c5a45",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      data-scroll-behavior="smooth"
      className={`${plexSans.variable} ${plexMono.variable} h-full scroll-smooth antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
