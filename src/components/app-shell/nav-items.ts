import {
  BedDouble,
  BellRing,
  LayoutDashboard,
  MessageCircleMore,
  MessageSquareWarning,
  ReceiptText,
  Settings,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import type { WorkspaceRingkas } from "@/lib/types";

export type Peran = WorkspaceRingkas["peran"];

export type NavItem = {
  href: string;
  label: string;
  /** Label ringkas untuk bottom nav mobile. */
  labelPendek: string;
  icon: LucideIcon;
  /** false = halaman belum dibangun; tampil redup dengan label "Segera". */
  siap: boolean;
  /** Tampil di bottom nav mobile. */
  mobile: boolean;
  /** Peran yang melihat menu ini. */
  peran: Peran[];
};

// Owner akses penuh; admin mengelola operasional organisasinya (tanpa Pengaturan);
// penyewa hanya tagihannya sendiri & tiket (portal penyewa, Fase 4).
const PENGELOLA: Peran[] = ["owner", "admin"];

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", labelPendek: "Beranda", icon: LayoutDashboard, siap: true, mobile: true, peran: PENGELOLA },
  { href: "/tagihan", label: "Tagihan & Invoice", labelPendek: "Tagihan", icon: ReceiptText, siap: true, mobile: true, peran: PENGELOLA },
  { href: "/kamar", label: "Kamar & Penghuni", labelPendek: "Kamar", icon: BedDouble, siap: true, mobile: true, peran: PENGELOLA },
  { href: "/pembayaran", label: "Pembayaran", labelPendek: "Bayar", icon: Wallet, siap: true, mobile: true, peran: PENGELOLA },
  { href: "/reminder", label: "Reminder", labelPendek: "Reminder", icon: BellRing, siap: true, mobile: false, peran: PENGELOLA },
  { href: "/kosta", label: "Chat Kosta AI", labelPendek: "Kosta AI", icon: MessageCircleMore, siap: true, mobile: true, peran: PENGELOLA },
  { href: "/tiket", label: "Tiket keluhan", labelPendek: "Tiket", icon: MessageSquareWarning, siap: true, mobile: false, peran: PENGELOLA },
  { href: "/pengaturan", label: "Pengaturan", labelPendek: "Atur", icon: Settings, siap: false, mobile: false, peran: ["owner"] },
  { href: "/tagihan-saya", label: "Tagihan saya", labelPendek: "Tagihan", icon: ReceiptText, siap: false, mobile: true, peran: ["penyewa"] },
  { href: "/tiket-saya", label: "Tiket keluhan", labelPendek: "Tiket", icon: MessageSquareWarning, siap: false, mobile: true, peran: ["penyewa"] },
];

/** Menu yang terlihat oleh sebuah peran, urut seperti NAV_ITEMS. */
export const navUntukPeran = (peran: Peran) => NAV_ITEMS.filter((item) => item.peran.includes(peran));
