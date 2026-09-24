import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { urlSitus } from "@/lib/situs";

import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
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
      className={`${jakarta.variable} h-full scroll-smooth antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
