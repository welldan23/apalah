// Konten landing dalam bentuk JSON untuk endpoint GET /api/landing/konten.
// Sumbernya sama dengan halaman landing (content.ts); komponen ikon diganti nama ikon Lucide
// supaya bisa diserialisasi. Isinya hanya copy & data contoh — tidak ada data kos sungguhan.

import type { LucideIcon } from "lucide-react";

import {
  BENEFIT,
  CARA_KERJA,
  CHAT_KOSTA,
  CTA_PENUTUP,
  CTA_TENGAH,
  FAQ,
  HERO,
  INTIP_DASHBOARD,
  MASALAH,
  PREVIEW_DASHBOARD,
} from "./content.ts";

const namaIkon = (icon: LucideIcon) => icon.displayName ?? "";

export function kontenPublik() {
  const { aksi, ...preview } = PREVIEW_DASHBOARD;
  return {
    hero: HERO,
    intipDashboard: INTIP_DASHBOARD,
    chatKosta: CHAT_KOSTA,
    masalah: MASALAH,
    benefit: BENEFIT.map(({ icon, ...benefit }) => ({ ...benefit, ikon: namaIkon(icon) })),
    caraKerja: CARA_KERJA.map(({ icon, ...langkah }) => ({ ...langkah, ikon: namaIkon(icon) })),
    previewDashboard: {
      ...preview,
      aksi: aksi.map(({ icon, ...a }) => ({ ...a, ikon: namaIkon(icon) })),
    },
    faq: FAQ,
    cta: { tengah: CTA_TENGAH, penutup: CTA_PENUTUP },
  };
}
