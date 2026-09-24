"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { panggilAuth } from "@/lib/auth/klien";
import { cn } from "@/lib/utils";

/** Keluar dari akun (hapus sesi login) lalu kembali ke halaman masuk. */
export function TombolKeluar({ className }: { className?: string }) {
  const router = useRouter();
  const [keluar, setKeluar] = useState(false);

  async function keluarAkun() {
    setKeluar(true);
    try {
      await panggilAuth("/sign-out", {});
    } finally {
      router.replace("/masuk");
      router.refresh();
    }
  }

  return (
    <Button variant="ghost" size="lg" className={cn("h-11", className)} disabled={keluar} onClick={keluarAkun}>
      <LogOut data-icon="inline-start" />
      {keluar ? "Keluar…" : "Keluar"}
    </Button>
  );
}
