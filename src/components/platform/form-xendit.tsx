"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { GalatServer, kirimAksi } from "@/components/quick-actions/action-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Sambungkan / lepaskan sub-akun xenPlatform kos — wajib alasan, tercatat di log admin. */
export function FormXendit({ organizationId, akunId }: { organizationId: string; akunId: string | null }) {
  const router = useRouter();
  const [akun, setAkun] = useState(akunId ?? "");
  const [alasan, setAlasan] = useState("");
  const [galat, setGalat] = useState<string | null>(null);
  const [mengirim, setMengirim] = useState(false);

  async function simpan(akunBaru: string | null) {
    setMengirim(true);
    setGalat(null);
    try {
      await kirimAksi(`/api/platform/workspace/${encodeURIComponent(organizationId)}/xendit`, { akunId: akunBaru, alasan });
      setAlasan("");
      if (akunBaru === null) setAkun("");
      router.refresh();
    } catch (err) {
      setGalat((err as Error).message);
    } finally {
      setMengirim(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void simpan(akun);
      }}
      className="flex flex-col gap-2"
    >
      <Label htmlFor="akun-xendit">ID sub-akun xenPlatform</Label>
      <Input
        id="akun-xendit"
        value={akun}
        onChange={(e) => setAkun(e.target.value)}
        placeholder="24 karakter, mis. 5cafeb170a2b18519b1b8761"
        autoComplete="off"
        spellCheck={false}
        className="h-11 font-mono"
      />
      <Label htmlFor="alasan-xendit">Alasan</Label>
      <textarea
        id="alasan-xendit"
        rows={2}
        maxLength={200}
        value={alasan}
        onChange={(e) => setAlasan(e.target.value)}
        placeholder="mis. KYC owner sudah disetujui Xendit"
        className="w-full rounded-lg border border-input bg-card px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:text-sm"
      />
      <GalatServer pesan={galat} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={mengirim} className="h-11">
          {mengirim ? "Menyimpan…" : akunId ? "Ganti sub-akun" : "Sambungkan"}
        </Button>
        {akunId && (
          <Button type="button" variant="destructive" disabled={mengirim} className="h-11" onClick={() => void simpan(null)}>
            Nonaktifkan pembayaran online
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Uang penyewa kos ini masuk ke saldo sub-akun tersebut (bukan akun Kostera). Tanpa sub-akun, halaman bayar menolak
        membuat QRIS/VA. Setelah diganti, halaman bayar membuat QRIS/VA baru ke sub-akun ini; pembayaran yang terlanjur masuk ke
        VA lama tetap tercatat.
      </p>
    </form>
  );
}
