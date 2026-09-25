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
import { getDb, tutupDb, schema, type Db } from "./index.ts";

type Env = Partial<Record<string, string>>;
export type HasilCek = { galat: string[]; peringatan: string[] };

const originDari = (url: string | undefined) => {
  try {
    return url ? new URL(url).origin : null;
  } catch {
    return null;
  }
};

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

  const provider = env.WHATSAPP_PROVIDER || "log";
  if (provider === "waha") galat.push("WHATSAPP_PROVIDER=waha tidak boleh di produksi — WAHA hanya untuk sandbox/pilot internal.");
  else if (provider !== "meta") galat.push(`WHATSAPP_PROVIDER=${provider}: produksi wajib "meta" (WhatsApp Cloud API); selain itu OTP & pesan tidak terkirim.`);
  if (provider === "meta" && (!env.META_WA_TOKEN || !env.META_WA_PHONE_NUMBER_ID)) {
    galat.push("META_WA_TOKEN dan META_WA_PHONE_NUMBER_ID wajib diisi untuk WhatsApp Cloud API.");
  }
  if (env.WAHA_IZINKAN_SEMUA_NOMOR === "true") galat.push("WAHA_IZINKAN_SEMUA_NOMOR=true tidak boleh di produksi.");
  if (env.WAHA_URL || env.WAHA_API_KEY) peringatan.push("Variabel WAHA_* terisi padahal tidak dipakai di produksi — sebaiknya dihapus.");
  if (provider === "meta" && env.WHATSAPP_NOMOR_UJI) {
    peringatan.push("WHATSAPP_NOMOR_UJI terisi: pesan hanya dikirim ke nomor uji itu, penyewa lain tidak menerima apa pun.");
  }
  if (!env.WHATSAPP_WEBHOOK_SECRET) peringatan.push("WHATSAPP_WEBHOOK_SECRET kosong: webhook WhatsApp masuk menolak semua, Kosta via WhatsApp tidak aktif.");
  if (provider === "meta" && !env.WHATSAPP_VERIFY_TOKEN) peringatan.push("WHATSAPP_VERIFY_TOKEN kosong: langganan webhook Meta tidak bisa diverifikasi.");

  if (!env.CRON_SECRET) peringatan.push("CRON_SECRET kosong: semua /api/cron/* menolak (401) — tagihan terjadwal & pengingat otomatis tidak jalan.");
  else if (env.CRON_SECRET.length < 32) galat.push("CRON_SECRET terlalu pendek, minimal 32 karakter acak.");

  const kunci = env.MIDTRANS_SERVER_KEY ?? "";
  const produksiMidtrans = env.MIDTRANS_PRODUCTION === "true";
  if (!kunci) peringatan.push("MIDTRANS_SERVER_KEY kosong: halaman bayar memakai mode contoh (VA/QR tidak bisa dibayar).");
  else if (produksiMidtrans && kunci.startsWith("SB-")) galat.push("MIDTRANS_PRODUCTION=true tapi server key-nya sandbox (SB-…).");
  else if (!produksiMidtrans && !kunci.startsWith("SB-")) galat.push("Server key Midtrans produksi dipakai tanpa MIDTRANS_PRODUCTION=true.");
  if (produksiMidtrans) {
    peringatan.push("Midtrans PRODUKSI aktif: pastikan Notification URL di dashboard Midtrans = APP_URL + /api/webhook/pembayaran/midtrans.");
  }
  if (!env.LLM_API_KEY) peringatan.push("LLM_API_KEY kosong: Kosta hanya memakai parser kata kunci.");
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
