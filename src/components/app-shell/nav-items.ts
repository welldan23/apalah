import {
  BedDouble,
  BellRing,
  LayoutDashboard,
  MessageCircleMore,
  ReceiptText,
  Settings,
  Wallet,
  type LucideIcon,
} from "lucide-react";

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
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", labelPendek: "Beranda", icon: LayoutDashboard, siap: true, mobile: true },
  { href: "/tagihan", label: "Tagihan & Invoice", labelPendek: "Tagihan", icon: ReceiptText, siap: true, mobile: true },
  { href: "/kamar", label: "Kamar & Penghuni", labelPendek: "Kamar", icon: BedDouble, siap: true, mobile: true },
  { href: "/pembayaran", label: "Pembayaran", labelPendek: "Bayar", icon: Wallet, siap: true, mobile: true },
  { href: "/reminder", label: "Reminder", labelPendek: "Reminder", icon: BellRing, siap: true, mobile: false },
  { href: "/kosta", label: "Chat Kosta", labelPendek: "Kosta", icon: MessageCircleMore, siap: true, mobile: true },
  { href: "/pengaturan", label: "Pengaturan", labelPendek: "Atur", icon: Settings, siap: false, mobile: false },
];
