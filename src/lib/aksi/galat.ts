// Galat aksi yang aman ditampilkan ke owner, lengkap dengan status HTTP-nya.

export class GalatAksi extends Error {
  readonly status: 400 | 401 | 403 | 404 | 409;

  constructor(message: string, status: 400 | 401 | 403 | 404 | 409 = 400) {
    super(message);
    this.status = status;
  }
}

/** Ubah galat menjadi Response JSON; galat tak terduga tidak dibocorkan detailnya. */
export function responGalat(err: unknown) {
  if (err instanceof GalatAksi) {
    return Response.json({ galat: err.message }, { status: err.status });
  }
  console.error(err);
  return Response.json({ galat: "Terjadi kesalahan di server. Coba lagi." }, { status: 500 });
}

/** Baca body JSON; body rusak → GalatAksi 400. */
export async function bacaJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    if (body && typeof body === "object" && !Array.isArray(body)) return body;
  } catch {}
  throw new GalatAksi("Body permintaan harus berupa objek JSON.");
}

/** Tanggal kalender "YYYY-MM-DD" yang benar-benar ada. */
export function tanggalValid(nilai: unknown): nilai is string {
  if (typeof nilai !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(nilai)) return false;
  const d = new Date(`${nilai}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === nilai;
}

export function nominalValid(nilai: unknown): nilai is number {
  return typeof nilai === "number" && Number.isInteger(nilai) && nilai > 0 && nilai <= 1_000_000_000;
}

/** Aksi yang mengubah data hanya untuk owner/admin, bukan penyewa. */
export function pastikanPengelola(peran: "owner" | "admin" | "penyewa") {
  if (peran === "penyewa") {
    throw new GalatAksi("Hanya owner atau admin kos yang bisa melakukan aksi ini.", 403);
  }
}
