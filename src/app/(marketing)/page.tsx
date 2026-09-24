import type { Metadata } from "next";

import { BenefitsSection } from "@/components/landing/benefits-section";
import { CtaSection } from "@/components/landing/cta-section";
import { DashboardPreviewSection } from "@/components/landing/dashboard-preview-section";
import { FaqSection } from "@/components/landing/faq-section";
import { HeroSection } from "@/components/landing/hero-section";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { ProblemSection } from "@/components/landing/problem-section";
import { CTA_PENUTUP, CTA_TENGAH } from "@/lib/landing/content";

export const metadata: Metadata = {
  title: { absolute: "Kostera — Tagihan kos rapi, pembayaran lebih pasti" },
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
