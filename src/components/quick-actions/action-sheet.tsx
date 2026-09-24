"use client";

import { CircleCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

/** Sheet aksi cepat: muncul dari bawah di mobile, dari kanan di layar lebar. */
export function ActionSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const layarLebar = useMediaQuery("(min-width: 640px)");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={layarLebar ? "right" : "bottom"}
        className={cn(
          "gap-0",
          layarLebar ? "w-full sm:max-w-md" : "max-h-[92dvh] rounded-t-2xl",
        )}
      >
        <SheetHeader className="border-b pr-12">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  );
}

/** Area isi yang bisa di-scroll di antara header dan footer sheet. */
export function SheetBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4", className)}>
      {children}
    </div>
  );
}

/** Footer sheet: tombol sekunder di kiri, aksi utama di kanan. */
export function SheetActions({ children }: { children: React.ReactNode }) {
  return (
    <SheetFooter className="mt-0 flex-row justify-end border-t pb-[max(1rem,env(safe-area-inset-bottom))] [&>*]:flex-1 sm:[&>*]:flex-none">
      {children}
    </SheetFooter>
  );
}

/** Ringkasan preview: label di kiri, nilai di kanan. */
export function PreviewRows({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="divide-y rounded-lg border bg-card text-sm">
      {rows.map(([label, nilai]) => (
        <div key={label} className="flex items-start justify-between gap-4 px-3 py-2.5">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="text-right font-medium tabular-nums">{nilai}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Keterangan bahwa sebagian aksi masih disimulasikan (mis. provider WhatsApp belum disambungkan). */
export function CatatanSimulasi({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">{children}</p>;
}

/** Galat dari server, ditampilkan di atas tombol aksi. */
export function GalatServer({ pesan }: { pesan: string | null }) {
  if (!pesan) return null;
  return (
    <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
      {pesan}
    </p>
  );
}

/** Layar sukses setelah owner mengonfirmasi. */
export function SelesaiState({
  judul,
  pesan,
  catatan,
}: {
  judul: string;
  pesan: string;
  catatan?: string;
}) {
  return (
    <>
      <SheetBody className="items-center justify-center py-10 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-success-soft text-success">
          <CircleCheck className="size-6" />
        </span>
        <div>
          <p className="text-base font-semibold">{judul}</p>
          <p className="mt-1 text-sm text-muted-foreground">{pesan}</p>
        </div>
        {catatan && <CatatanSimulasi>{catatan}</CatatanSimulasi>}
      </SheetBody>
      <SheetActions>
        <SheetClose asChild>
          <Button size="lg">Selesai</Button>
        </SheetClose>
      </SheetActions>
    </>
  );
}

export function FieldError({ id, pesan }: { id: string; pesan?: string }) {
  if (!pesan) return null;
  return (
    <p id={id} className="text-xs text-danger">
      {pesan}
    </p>
  );
}

/** POST JSON ke endpoint aksi cepat; galat dari server dilempar sebagai Error berpesan. */
export async function kirimAksi<T>(url: string, body: unknown, method: "POST" | "PUT" = "POST"): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Tidak bisa terhubung ke server. Periksa koneksi lalu coba lagi.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.galat ?? "Gagal menyimpan. Coba lagi.");
  return data as T;
}
