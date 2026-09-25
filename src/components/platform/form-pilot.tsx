"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { GalatServer, kirimAksi } from "@/components/quick-actions/action-sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

/** Suspend / aktifkan kembali pilot Kosta satu kos — wajib alasan, tercatat di log admin. */
export function FormPilot({ organizationId, aktif }: { organizationId: string; aktif: boolean }) {
  const router = useRouter();
  const [alasan, setAlasan] = useState("");
  const [galat, setGalat] = useState<string | null>(null);
  const [mengirim, setMengirim] = useState(false);

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    setMengirim(true);
    setGalat(null);
    try {
      await kirimAksi(`/api/platform/workspace/${encodeURIComponent(organizationId)}/pilot`, { aktif: !aktif, alasan });
      setAlasan("");
      router.refresh();
    } catch (err) {
      setGalat((err as Error).message);
    } finally {
      setMengirim(false);
    }
  }

  return (
    <form onSubmit={kirim} className="flex flex-col gap-2">
      <Label htmlFor="alasan-pilot">{aktif ? "Alasan suspend" : "Alasan mengaktifkan kembali"}</Label>
      <textarea
        id="alasan-pilot"
        rows={2}
        maxLength={200}
        value={alasan}
        onChange={(e) => setAlasan(e.target.value)}
        placeholder={aktif ? "mis. nomor WAHA diblokir, investigasi spam" : "mis. masalah sudah selesai"}
        className="w-full rounded-lg border border-input bg-card px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:text-sm"
      />
      <GalatServer pesan={galat} />
      <Button type="submit" variant={aktif ? "destructive" : "default"} disabled={mengirim} className="h-11 self-start">
        {mengirim ? "Menyimpan…" : aktif ? "Suspend pilot Kosta" : "Aktifkan kembali"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Suspend hanya menghentikan chat Kosta untuk kos ini. Data kos, tagihan, dan pembayaran tidak berubah; owner melihat
        statusnya di dashboard.
      </p>
    </form>
  );
}
