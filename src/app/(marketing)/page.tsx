import type { Metadata } from "next";

import { BenefitsSection } from "@/components/landing/benefits-section";
import { CtaSection } from "@/components/landing/cta-section";
import { DashboardPreviewSection } from "@/components/landing/dashboard-preview-section";
import { FaqSection } from "@/components/landing/faq-section";
import { HeroSection } from "@/components/landing/hero-section";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { ProblemSection } from "@/components/landing/problem-section";
import { CTA_PENUTUP, CTA_TENGAH } from "@/lib/landing/content";
import { urlLanding } from "@/lib/situs";

const JUDUL = "Kostera — Tagihan kos rapi, pembayaran lebih pasti";
const DESKRIPSI =
  "Kelola tagihan, pembayaran, dan kamar kos dalam satu tempat. Kosta AI, asisten di WhatsApp, bantu cek tunggakan dan siapkan pengingat.";

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
  return (
    <>
      <HeroSection />
      <ProblemSection />
      <BenefitsSection />
      <HowItWorksSection />
      <CtaSection id="cta-tengah" cta={CTA_TENGAH} className="pt-0 sm:pt-0" />
      <DashboardPreviewSection />
      <FaqSection />
      <CtaSection id="cta-penutup" cta={CTA_PENUTUP} />
    </>
  );
}
