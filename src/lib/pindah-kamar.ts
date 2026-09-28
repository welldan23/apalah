// Pilihan kamar tujuan untuk pindah kamar: hanya kamar kosong, tipe yang sama didahulukan.

type Kamar = { id: string; nomorKamar: string; tipe: string; status: "terisi" | "kosong" };

export function kamarTujuan<T extends Kamar>(semua: T[], asal: Pick<Kamar, "id" | "tipe">): T[] {
  return semua
    .filter((k) => k.status === "kosong" && k.id !== asal.id)
    .sort((a, b) => {
      const tipeSama = Number(b.tipe === asal.tipe) - Number(a.tipe === asal.tipe);
      return tipeSama || a.nomorKamar.localeCompare(b.nomorKamar, "id", { numeric: true });
    });
}
