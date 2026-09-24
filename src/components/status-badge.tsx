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
import type { InvoiceStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

// Warna status dipakai terbatas: selalu disertai ikon + label, tidak pernah warna saja.
export type StatusTone = "success" | "neutral" | "danger" | "warning" | "info" | "outline";

const TONE_BADGE: Record<StatusTone, string> = {
  success: "bg-success-soft text-success",
  neutral: "bg-muted text-muted-foreground",
  danger: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning",
  info: "bg-secondary text-secondary-foreground",
  outline: "border-border bg-transparent text-muted-foreground",
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
    <Badge variant="outline" className={cn("border-transparent", TONE_BADGE[tone], className)}>
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
