import {
  CircleAlert,
  CircleCheck,
  CircleDashed,
  Clock,
  Eye,
  Send,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { InvoiceStatus, PaymentStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

// Status tampil seperti cap di nota: label + garis tepi berwarna, tidak pernah warna saja.
export type StatusTone = "success" | "neutral" | "danger" | "warning" | "info" | "outline";

const TONE_BADGE: Record<StatusTone, string> = {
  success: "border-success/45 bg-success-soft/60 text-success",
  neutral: "border-border bg-transparent text-muted-foreground",
  danger: "border-danger/45 bg-danger-soft/60 text-danger",
  warning: "border-warning/50 bg-warning-soft/70 text-warning",
  info: "border-secondary-foreground/25 bg-transparent text-secondary-foreground",
  outline: "border-dashed border-border bg-transparent text-muted-foreground",
};

/** Warna titik/penanda kecil untuk tone yang sama (legenda, rincian). */
export const TONE_DOT: Record<StatusTone, string> = {
  success: "bg-success",
  neutral: "bg-muted-foreground/50",
  danger: "bg-danger",
  warning: "bg-warning",
  info: "bg-secondary-foreground/60",
  outline: "bg-border",
};

export function StatusBadge({
  tone,
  icon: Icon,
  children,
  className,
}: {
  tone: StatusTone;
  icon: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn("h-auto rounded-[3px] py-px font-semibold", TONE_BADGE[tone], className)}>
      <Icon data-icon="inline-start" aria-hidden="true" />
      {children}
    </Badge>
  );
}

const STATUS_INVOICE: Record<
  InvoiceStatus,
  { label: string; tone: StatusTone; icon: LucideIcon }
> = {
  lunas: { label: "Lunas", tone: "success", icon: CircleCheck },
  menunggu: { label: "Menunggu", tone: "neutral", icon: Clock },
  jatuh_tempo: { label: "Jatuh tempo", tone: "danger", icon: CircleAlert },
  perlu_review: { label: "Perlu review", tone: "warning", icon: Eye },
  terkirim: { label: "Terkirim", tone: "info", icon: Send },
  draft: { label: "Draft", tone: "outline", icon: CircleDashed },
};

export function labelStatusInvoice(status: InvoiceStatus) {
  return STATUS_INVOICE[status].label;
}

export function toneStatusInvoice(status: InvoiceStatus) {
  return STATUS_INVOICE[status].tone;
}

export function InvoiceStatusBadge({
  status,
  className,
}: {
  status: InvoiceStatus;
  className?: string;
}) {
  const { label, tone, icon } = STATUS_INVOICE[status];
  return (
    <StatusBadge tone={tone} icon={icon} className={className}>
      {label}
    </StatusBadge>
  );
}

const STATUS_PEMBAYARAN: Record<
  PaymentStatus,
  { label: string; tone: StatusTone; icon: LucideIcon }
> = {
  valid: { label: "Terverifikasi", tone: "success", icon: CircleCheck },
  tidak_cocok: { label: "Tidak cocok", tone: "warning", icon: CircleAlert },
  pending: { label: "Menunggu verifikasi", tone: "neutral", icon: Clock },
};

export function PaymentStatusBadge({
  status,
  className,
}: {
  status: PaymentStatus;
  className?: string;
}) {
  const { label, tone, icon } = STATUS_PEMBAYARAN[status];
  return (
    <StatusBadge tone={tone} icon={icon} className={className}>
      {label}
    </StatusBadge>
  );
}
