// Pemeriksaan sebelum deploy produksi (app.kostera.id). Hanya membaca — tidak mengubah apa pun dan
// tidak pernah mencetak nilai rahasia; yang dilaporkan hanya ada/tidaknya dan bentuknya.
// Pakai (di server/CI dengan environment produksi yang sama):
//   npm run cek:produksi
// Keluar dengan kode 1 bila ada galat yang harus dibereskan sebelum deploy.

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { inArray, like, sql } from "drizzle-orm";

import { mockOrganization } from "../lib/mock/kos-melati.ts";
import { mockWorkspaceLain } from "../lib/mock/kosta.ts";
import { normalisasiNomorWa } from "../lib/nomor-wa.ts";
import { getDb, tutupDb, schema, type Db } from "./index.ts";

type Env = Partial<Record<string, string>>;
export type HasilCek = { galat: string[]; peringatan: string[] };

const urlAtauNull = (url: string | undefined) => {
  try {
    return url ? new URL(url) : null;
  } catch {
    return null;
  }
};
const originDari = (url: string | undefined) => urlAtauNull(url)?.origin ?? null;

/** Cek environment produksi tanpa membaca database. */
export function periksaEnvProduksi(env: Env): HasilCek {
  const galat: string[] = [];
  const peringatan: string[] = [];

  if (!/^postgres(ql)?:\/\//.test(env.DATABASE_URL ?? "")) {
    galat.push("DATABASE_URL belum diisi connection string PostgreSQL (produksi tidak boleh memakai PGlite).");
  }
  const app = originDari(env.APP_URL);
  if (!app?.startsWith("https://")) galat.push("APP_URL harus alamat https, mis. https://app.kostera.id.");
  const landing = originDari(env.LANDING_URL);
  if (!env.LANDING_URL) peringatan.push("LANDING_URL kosong: landing & aplikasi di satu domain (APP_URL); kostera.id tidak dilayani deploy ini.");
  else if (!landing?.startsWith("https://")) galat.push("LANDING_URL harus alamat https, mis. https://kostera.id.");
  else if (landing === app) galat.push("LANDING_URL harus beda domain dengan APP_URL (mis. kostera.id vs app.kostera.id).");
  if ((env.BETTER_AUTH_SECRET ?? "").length < 32) galat.push("BETTER_AUTH_SECRET wajib diisi, minimal 32 karakter acak.");
  if (env.BETTER_AUTH_URL && originDari(env.BETTER_AUTH_URL) !== app) {
    galat.push("BETTER_AUTH_URL harus sama dengan APP_URL (atau dikosongkan), kalau tidak login ditolak.");
  }

  // KOSTERA_MODE=pilot: pilot internal lewat WAHA, khusus nomor owner di WHATSAPP_NOMOR_UJI.
  // Kosong = produksi penuh (wajib Meta Cloud API).
  const modePilot = env.KOSTERA_MODE === "pilot";
  if (env.KOSTERA_MODE && !modePilot) galat.push('KOSTERA_MODE hanya boleh "pilot" atau dikosongkan (produksi).');
  const provider = env.WHATSAPP_PROVIDER || "log";
  if (provider === "waha" && !modePilot) {
    galat.push("WHATSAPP_PROVIDER=waha tidak boleh di produksi — WAHA hanya untuk pilot internal (KOSTERA_MODE=pilot).");
  } else if (provider === "waha") {
    peringatan.push(
      "Mode pilot WAHA: hanya nomor di WHATSAPP_NOMOR_UJI yang dikirimi (OTP & Kosta AI); pesan ke penyewa ditahan. Pindah ke Meta untuk produksi.",
    );
    if (!(env.WHATSAPP_NOMOR_UJI ?? "").split(",").some((n) => normalisasiNomorWa(n))) {
      galat.push("Mode pilot wajib WHATSAPP_NOMOR_UJI: nomor WA owner pilot (format 628…, dipisah koma).");
    }
    const waha = urlAtauNull(env.WAHA_URL);
    const lokal = ["localhost", "127.0.0.1", "[::1]"].includes(waha?.hostname ?? "");
    if (!waha || (waha.protocol !== "https:" && !(waha.protocol === "http:" && lokal))) {
      galat.push("WAHA_URL wajib alamat https (http hanya boleh untuk localhost di server yang sama).");
    }
    if (!env.WAHA_API_KEY) galat.push("WAHA_API_KEY wajib — tanpa itu siapa pun bisa memakai sesi WhatsApp di server WAHA.");
  } else if (provider !== "meta") {
    galat.push(`WHATSAPP_PROVIDER=${provider}: produksi wajib "meta" (WhatsApp Cloud API); selain itu OTP & pesan tidak terkirim.`);
  }
  if (provider === "meta" && (!env.META_WA_TOKEN || !env.META_WA_PHONE_NUMBER_ID)) {
    galat.push("META_WA_TOKEN dan META_WA_PHONE_NUMBER_ID wajib diisi untuk WhatsApp Cloud API.");
  }
  if (env.WAHA_IZINKAN_SEMUA_NOMOR === "true") galat.push("WAHA_IZINKAN_SEMUA_NOMOR=true tidak boleh di produksi maupun pilot.");
  if (provider !== "waha" && (env.WAHA_URL || env.WAHA_API_KEY)) {
    peringatan.push("Variabel WAHA_* terisi padahal tidak dipakai di produksi — sebaiknya dihapus.");
  }
  if (provider === "meta" && env.WHATSAPP_NOMOR_UJI) {
    peringatan.push("WHATSAPP_NOMOR_UJI terisi: pesan hanya dikirim ke nomor uji itu, penyewa lain tidak menerima apa pun.");
  }
  // WhatsApp first: tanpa ini Kosta AI tidak bisa menerima chat sama sekali.
  if (!env.WHATSAPP_WEBHOOK_SECRET) galat.push("WHATSAPP_WEBHOOK_SECRET wajib: tanpa itu webhook WhatsApp menolak semua dan Kosta AI tidak menerima chat.");
  if (provider === "meta" && !env.WHATSAPP_VERIFY_TOKEN) galat.push("WHATSAPP_VERIFY_TOKEN wajib: tanpa itu langganan webhook Meta tidak bisa diverifikasi.");

  if (!env.CRON_SECRET) peringatan.push("CRON_SECRET kosong: semua /api/cron/* menolak (401) — tagihan terjadwal & pengingat otomatis tidak jalan.");
  else if (env.CRON_SECRET.length < 32) galat.push("CRON_SECRET terlalu pendek, minimal 32 karakter acak.");

  const kunci = env.XENDIT_SECRET_KEY ?? "";
  if (!kunci) peringatan.push("XENDIT_SECRET_KEY kosong: halaman bayar memakai mode contoh (VA/QR tidak bisa dibayar).");
  else if (!/^xnd_(development|production)_/.test(kunci)) {
    galat.push("XENDIT_SECRET_KEY bukan secret key Xendit (harus diawali xnd_development_ atau xnd_production_).");
  } else if (kunci.startsWith("xnd_development_")) {
    peringatan.push("Xendit mode TEST (xnd_development_…): pembayaran penyewa bukan uang sungguhan.");
  }
  if (kunci && !env.XENDIT_WEBHOOK_TOKEN) {
    galat.push("XENDIT_WEBHOOK_TOKEN wajib: tanpa itu webhook Xendit ditolak dan tagihan tidak pernah jadi Lunas.");
  }
  if (!env.LLM_API_KEY) peringatan.push("LLM_API_KEY kosong: Kosta AI hanya memakai parser kata kunci.");
  return { galat, peringatan };
}

/** Data contoh (Kos Melati dkk., token invoice "demo-…") tidak boleh ada di database produksi. */
export async function periksaDataContoh(db: Db): Promise<string[]> {
  const idContoh = [mockOrganization.id, ...mockWorkspaceLain.map((w) => w.id)];
  const org = await db.select({ id: schema.organizations.id }).from(schema.organizations).where(inArray(schema.organizations.id, idContoh));
  const token = await db.select({ id: schema.invoices.id }).from(schema.invoices).where(like(schema.invoices.tokenPublik, "demo-%")).limit(1);
  return org.length || token.length
    ? ["Database berisi data contoh (npm run db:seed). Pakai database produksi yang bersih — jangan hapus data sembarangan tanpa backup."]
    : [];
}

/** Jumlah migrasi di drizzle/ yang belum tercatat di database (semua bila database masih kosong). */
async function migrasiTertunda(db: Db) {
  const total = (JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as { entries: unknown[] }).entries.length;
  try {
    const hasil = (await db.execute(sql`select count(*)::int as jumlah from drizzle.__drizzle_migrations`)) as unknown;
    const baris = Array.isArray(hasil) ? hasil : (hasil as { rows: unknown[] }).rows;
    return { tertunda: total - Number((baris[0] as { jumlah: number }).jumlah), total };
  } catch (err) {
    // 3F000/42P01: schema/tabel migrasi belum ada = database baru. Galat lain (koneksi, izin) diteruskan.
    const e = err as { code?: string; cause?: { code?: string } };
    if (["3F000", "42P01"].includes(e.cause?.code ?? e.code ?? "")) return { tertunda: total, total };
    throw err;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const { galat, peringatan } = periksaEnvProduksi(process.env);
  try {
    if (/^postgres(ql)?:\/\//.test(process.env.DATABASE_URL ?? "")) {
      const db = await getDb();
      const { tertunda, total } = await migrasiTertunda(db);
      if (tertunda > 0) peringatan.push(`${tertunda} migrasi belum dijalankan — jalankan npm run db:migrate setelah backup.`);
      // Database yang belum pernah dimigrasi belum punya tabel untuk diperiksa.
      if (tertunda < total) galat.push(...(await periksaDataContoh(db)));
    }
  } catch (err) {
    const e = err as { code?: string; cause?: { code?: string } };
    galat.push(`Database tidak bisa dibaca (kode ${e.cause?.code ?? e.code ?? "tidak diketahui"}).`);
  } finally {
    await tutupDb();
  }
  for (const g of galat) console.log(`✗ ${g}`);
  for (const p of peringatan) console.log(`! ${p}`);
  console.log(galat.length ? `\n${galat.length} galat — belum siap deploy.` : "\n✓ Tidak ada galat. Tinjau peringatan di atas sebelum deploy.");
  process.exitCode = galat.length ? 1 : 0;
}
