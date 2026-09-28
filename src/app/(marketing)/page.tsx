import type { Metadata } from "next";

import { AlurSection } from "@/components/landing/alur-section";
import { FaqSection } from "@/components/landing/faq-section";
import { HeroSection } from "@/components/landing/hero-section";
import { urlLanding } from "@/lib/situs";

const JUDUL = "Kostera — Tagihan kos rapi, pembayaran lebih pasti";
const DESKRIPSI =
  "Urus kos cukup lewat chat WhatsApp dengan Kosta AI: cek tunggakan, siapkan tagihan dan pengingat, lalu konfirmasi pakai kode. Dashboard Kostera merangkum semuanya.";

export const metadata: Metadata = {
  title: { absolute: JUDUL },
  description: DESKRIPSI,
  // Landing tinggal di domain landing (kostera.id), bukan domain aplikasi.
  alternates: { canonical: `${urlLanding()}/` },
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: `${urlLanding()}/`,
    siteName: "Kostera",
    title: JUDUL,
    description: DESKRIPSI,
  },
};

export default function LandingPage() {
  // Narrative Workflow: hero → satu bulan di kos tahap demi tahap → tanya-jawab; penutupnya di footer.
  return (
    <>
      <HeroSection />
      <AlurSection />
      <FaqSection />
    </>
  );
}
