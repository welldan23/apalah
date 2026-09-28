// Konsol platform Kostera (hanya platform_admin): metrik lintas workspace yang aman, cari workspace,
// detail integrasi tersanitasi, suspend/resume pilot Kosta, dan menyambungkan kos ke sub-akun Xendit-nya.
// Tidak ada jalur untuk mengubah invoice, pembayaran, atau data penyewa. Membuka detail workspace dan
// setiap perubahan selalu tercatat di platform_admin_logs.

import { and, count, desc, eq, gte, ilike, inArray, isNotNull, lt, max, ne, or, sql } from "drizzle-orm";

import { schema, type Db } from "../../db/index.ts";
import { GalatAksi } from "../aksi/galat.ts";
import { MASA_BERLAKU_DRAFT_MS } from "../kosta/draft.ts";
import { modeWhatsApp, wahaDitahan } from "../whatsapp/index.ts";
import { catatLogPlatform } from "./akses.ts";

const { actionDrafts, kostaAuditLogs, kostaPilot, members, organizations, users, waWebhookEvents, whatsappLogs } = schema;

type Env = Partial<Record<string, string>>;

/** "6281234567890" → "6281****7890" — cukup untuk dikenali, tidak untuk disalin. */
export const samarkanNomor = (nomor: string) => (nomor.length > 8 ? `${nomor.slice(0, 4)}****${nomor.slice(-4)}` : "****");

/** Konfigurasi provider dari environment — hanya ada/tidaknya rahasia, bukan nilainya. */
export function ringkasProvider(env: Env = process.env) {
  const { provider, mode } = modeWhatsApp(env);
  return {
    provider,
    mode,
    nomorUji: (env.WHATSAPP_NOMOR_UJI ?? "").split(",").filter((n) => n.trim()).length,
    /** WAHA tanpa daftar nomor uji: semua kiriman ditahan (aman untuk pilot). */
    kirimDitahan: wahaDitahan(env),
    rahasiaWebhook: !!env.WHATSAPP_WEBHOOK_SECRET,
    tokenVerifikasiMeta: !!env.WHATSAPP_VERIFY_TOKEN,
    llmAktif: !!env.LLM_API_KEY,
    modelLlm: env.LLM_MODEL || "openai/gpt-5.4-mini",
  };
}

const perStatus = <K extends string>(baris: { k: K | null; n: number }[]) =>
  Object.fromEntries(baris.map((b) => [b.k ?? "-", b.n])) as Record<string, number>;

export async function getMetrikPlatform(db: Db, { sekarang = new Date(), env = process.env }: { sekarang?: Date; env?: Env } = {}) {
  const sehari = new Date(sekarang.getTime() - 24 * 3_600_000);
  const sebulan = new Date(sekarang.getTime() - 30 * 24 * 3_600_000);

  const [[ws], [pemilik], [aktifKosta], [disuspend]] = await Promise.all([
    db.select({ n: count() }).from(organizations),
    db
      .select({ n: sql<number>`count(distinct ${members.userId})`.mapWith(Number) })
      .from(members)
      .where(and(eq(members.peran, "owner"), eq(members.status, "aktif"))),
    db
      .select({ n: sql<number>`count(distinct ${kostaAuditLogs.organizationId})`.mapWith(Number) })
      .from(kostaAuditLogs)
      .where(and(isNotNull(kostaAuditLogs.organizationId), gte(kostaAuditLogs.dibuatPada, sebulan))),
    db.select({ n: count() }).from(kostaPilot).where(eq(kostaPilot.aktif, false)),
  ]);

  const webhook = perStatus(
    await db
      .select({ k: waWebhookEvents.status, n: count() })
      .from(waWebhookEvents)
      .where(gte(waWebhookEvents.dibuatPada, sehari))
      .groupBy(waWebhookEvents.status),
  );
  const [galatTerakhir] = await db
    .select({ waktu: max(waWebhookEvents.dibuatPada) })
    .from(waWebhookEvents)
    .where(ne(waWebhookEvents.status, "diterima"));
  const [duplikat] = await db
    .select({ n: sql<number>`coalesce(sum(${waWebhookEvents.jumlahPesan} - ${waWebhookEvents.pesanBaru}), 0)`.mapWith(Number) })
    .from(waWebhookEvents)
    .where(gte(waWebhookEvents.dibuatPada, sehari));

  const kirim = perStatus(
    await db
      .select({ k: whatsappLogs.status, n: count() })
      .from(whatsappLogs)
      .where(gte(whatsappLogs.dibuatPada, sehari))
      .groupBy(whatsappLogs.status),
  );
  const [suksesTerakhir] = await db
    .select({ waktu: max(whatsappLogs.dibuatPada) })
    .from(whatsappLogs)
    .where(eq(whatsappLogs.status, "terkirim"));

  const kosta = perStatus(
    await db
      .select({ k: kostaAuditLogs.hasil, n: count() })
      .from(kostaAuditLogs)
      .where(gte(kostaAuditLogs.dibuatPada, sehari))
      .groupBy(kostaAuditLogs.hasil),
  );
  const batasBerlaku = new Date(sekarang.getTime() - MASA_BERLAKU_DRAFT_MS);
  const [[menunggu], [basi]] = await Promise.all([
    db
      .select({ n: count() })
      .from(actionDrafts)
      .where(and(eq(actionDrafts.status, "menunggu_konfirmasi"), gte(actionDrafts.dibuatPada, batasBerlaku))),
    db
      .select({ n: count() })
      .from(actionDrafts)
      .where(and(eq(actionDrafts.status, "menunggu_konfirmasi"), lt(actionDrafts.dibuatPada, batasBerlaku))),
  ]);

  const terkirim = kirim.terkirim ?? 0;
  const gagal = kirim.gagal ?? 0;
  const rasioGagal = terkirim + gagal ? gagal / (terkirim + gagal) : 0;
  const galatWebhook = Object.entries(webhook).reduce((n, [k, v]) => (k === "diterima" ? n : n + v), 0);
  return {
    workspace: { total: ws.n, pemilikAktif: pemilik.n, pakaiKosta30Hari: aktifKosta.n, pilotDisuspend: disuspend.n },
    provider: ringkasProvider(env),
    webhook24Jam: { diterima: webhook.diterima ?? 0, galat: galatWebhook, duplikat: duplikat.n, perStatus: webhook, galatTerakhir: galatTerakhir.waktu },
    kirim24Jam: { terkirim, gagal, rasioGagal, suksesTerakhir: suksesTerakhir.waktu },
    kosta24Jam: kosta,
    aksi: { menungguKonfirmasi: menunggu.n, kedaluwarsaBelumDibersihkan: basi.n },
    kesehatan: terkirim + gagal === 0 ? "belum ada kiriman" : rasioGagal <= 0.2 ? "sehat" : "perlu dicek",
  };
}

export type MetrikPlatform = Awaited<ReturnType<typeof getMetrikPlatform>>;

const escapeLike = (teks: string) => teks.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Cari workspace berdasarkan ID persis atau potongan nama kos (maks 20). */
export async function cariWorkspace(db: Db, q: string) {
  const kata = q.trim().slice(0, 100);
  const baris = await db
    .select({
      id: organizations.id,
      namaKos: organizations.namaKos,
      jumlahKamar: organizations.jumlahKamar,
      dibuatPada: organizations.dibuatPada,
      pilotAktif: sql<boolean>`coalesce(${kostaPilot.aktif}, true)`,
    })
    .from(organizations)
    .leftJoin(kostaPilot, eq(kostaPilot.organizationId, organizations.id))
    .where(kata ? or(eq(organizations.id, kata), ilike(organizations.namaKos, `%${escapeLike(kata)}%`)) : undefined)
    .orderBy(organizations.namaKos)
    .limit(20);
  return baris;
}

/**
 * Detail satu workspace untuk support: status integrasi, identitas WA tertaut (disamarkan), dan event
 * Kosta/WhatsApp tanpa payload maupun data penyewa. Membukanya tercatat di platform_admin_logs.
 */
export async function getDetailWorkspace(
  db: Db,
  { organizationId, adminUserId, sekarang = new Date() }: { organizationId: string; adminUserId: string; sekarang?: Date },
) {
  const [org] = await db
    .select({
      id: organizations.id,
      namaKos: organizations.namaKos,
      jumlahKamar: organizations.jumlahKamar,
      dibuatPada: organizations.dibuatPada,
      xenditAkunId: organizations.xenditAkunId,
    })
    .from(organizations)
    .where(eq(organizations.id, organizationId));
  if (!org) return null;
  await catatLogPlatform(db, { adminUserId, aksi: "lihat_workspace", organizationId });

  const seminggu = new Date(sekarang.getTime() - 7 * 24 * 3_600_000);
  const pengelola = await db
    .select({ nama: users.nama, nomorWa: users.nomorWa, terverifikasi: users.nomorWaTerverifikasi, peran: members.peran })
    .from(members)
    .innerJoin(users, eq(users.id, members.userId))
    .where(and(eq(members.organizationId, organizationId), eq(members.status, "aktif"), inArray(members.peran, ["owner", "admin"])));
  const [pilot] = await db.select().from(kostaPilot).where(eq(kostaPilot.organizationId, organizationId));
  const eventKosta = await db
    .select({
      waktu: kostaAuditLogs.dibuatPada,
      saluran: kostaAuditLogs.saluran,
      intent: kostaAuditLogs.intent,
      hasil: kostaAuditLogs.hasil,
      statusKonfirmasi: kostaAuditLogs.statusKonfirmasi,
    })
    .from(kostaAuditLogs)
    .where(eq(kostaAuditLogs.organizationId, organizationId))
    .orderBy(desc(kostaAuditLogs.dibuatPada))
    .limit(20);
  const kirim = perStatus(
    await db
      .select({ k: whatsappLogs.status, n: count() })
      .from(whatsappLogs)
      .where(and(eq(whatsappLogs.organizationId, organizationId), gte(whatsappLogs.dibuatPada, seminggu)))
      .groupBy(whatsappLogs.status),
  );
  const galatKirim = await db
    .select({ waktu: whatsappLogs.dibuatPada, jenis: whatsappLogs.jenis, provider: whatsappLogs.provider, galat: whatsappLogs.galat })
    .from(whatsappLogs)
    .where(and(eq(whatsappLogs.organizationId, organizationId), eq(whatsappLogs.status, "gagal")))
    .orderBy(desc(whatsappLogs.dibuatPada))
    .limit(10);
  const [menunggu] = await db
    .select({ n: count() })
    .from(actionDrafts)
    .where(
      and(
        eq(actionDrafts.organizationId, organizationId),
        eq(actionDrafts.status, "menunggu_konfirmasi"),
        gte(actionDrafts.dibuatPada, new Date(sekarang.getTime() - MASA_BERLAKU_DRAFT_MS)),
      ),
    );

  return {
    ...org,
    pilot: { aktif: pilot?.aktif ?? true, alasan: pilot?.alasan ?? null, diubahPada: pilot?.diubahPada ?? null },
    pengelola: pengelola.map((p) => ({ nama: p.nama, peran: p.peran, nomorWa: samarkanNomor(p.nomorWa), terverifikasi: p.terverifikasi })),
    aksiMenunggu: menunggu.n,
    kirim7Hari: { terkirim: kirim.terkirim ?? 0, gagal: kirim.gagal ?? 0 },
    galatKirim,
    eventKosta,
  };
}

export type DetailWorkspace = NonNullable<Awaited<ReturnType<typeof getDetailWorkspace>>>;

function bacaAlasan(body: Record<string, unknown>) {
  const alasan = typeof body.alasan === "string" ? body.alasan.trim() : "";
  if (alasan.length < 5 || alasan.length > 200) throw new GalatAksi("Tulis alasan 5–200 karakter (tercatat di log platform).");
  return alasan;
}

export function bacaInputPilot(body: Record<string, unknown>) {
  if (typeof body.aktif !== "boolean") throw new GalatAksi("Pilih suspend atau aktifkan kembali.");
  return { aktif: body.aktif, alasan: bacaAlasan(body) };
}

/** ID akun Xendit (xenPlatform) = 24 karakter heksadesimal. */
const POLA_AKUN_XENDIT = /^[0-9a-f]{24}$/;

/** `akunId` null = lepaskan (pembayaran online kos berhenti). */
export function bacaInputXendit(body: Record<string, unknown>) {
  const akunId = body.akunId === null ? null : typeof body.akunId === "string" ? body.akunId.trim().toLowerCase() : undefined;
  if (akunId === undefined || (akunId !== null && !POLA_AKUN_XENDIT.test(akunId))) {
    throw new GalatAksi("ID sub-akun Xendit harus 24 karakter (salin dari menu xenPlatform di dashboard Xendit).");
  }
  return { akunId, alasan: bacaAlasan(body) };
}

/**
 * Sambungkan kos ke sub-akun xenPlatform-nya (atau lepaskan). Menentukan ke mana uang penyewa masuk,
 * jadi wajib alasan dan tercatat (akun lama → baru). QRIS/VA yang sudah dibuat ke akun lama tidak
 * ditawarkan lagi, tapi pembayarannya tetap diverifikasi ke akun tempat transaksi itu dibuat.
 */
export async function aturAkunXendit(
  db: Db,
  { organizationId, akunId, alasan, adminUserId }: { organizationId: string; akunId: string | null; alasan: string; adminUserId: string },
) {
  return db.transaction(async (tx) => {
    const [org] = await tx
      .select({ id: organizations.id, akunLama: organizations.xenditAkunId })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .for("update");
    if (!org) throw new GalatAksi("Workspace tidak ditemukan.", 404);
    if (akunId) {
      const [dipakai] = await tx
        .select({ id: organizations.id })
        .from(organizations)
        .where(and(eq(organizations.xenditAkunId, akunId), ne(organizations.id, organizationId)));
      if (dipakai) throw new GalatAksi("Sub-akun Xendit ini sudah tersambung ke kos lain.", 409);
    }
    await tx.update(organizations).set({ xenditAkunId: akunId }).where(eq(organizations.id, organizationId));
    await catatLogPlatform(tx, {
      adminUserId,
      aksi: "atur_xendit",
      organizationId,
      detail: { akunLama: org.akunLama, akunBaru: akunId, alasan },
    });
    return { akunId };
  });
}

/** Suspend / aktifkan kembali pilot Kosta satu kos; hanya tabel kosta_pilot yang berubah, dan tercatat. */
export async function aturPilotKosta(
  db: Db,
  { organizationId, aktif, alasan, adminUserId }: { organizationId: string; aktif: boolean; alasan: string; adminUserId: string },
) {
  return db.transaction(async (tx) => {
    const [org] = await tx.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, organizationId));
    if (!org) throw new GalatAksi("Workspace tidak ditemukan.", 404);
    const sekarang = new Date();
    await tx
      .insert(kostaPilot)
      .values({ organizationId, aktif, alasan, diubahOleh: adminUserId, diubahPada: sekarang })
      .onConflictDoUpdate({ target: kostaPilot.organizationId, set: { aktif, alasan, diubahOleh: adminUserId, diubahPada: sekarang } });
    await catatLogPlatform(tx, { adminUserId, aksi: aktif ? "resume_pilot" : "suspend_pilot", organizationId, detail: { alasan } });
    return { aktif, alasan };
  });
}

/** Log platform terbaru untuk halaman log perubahan. */
export async function getLogPlatform(db: Db, batas = 100) {
  return db
    .select({
      waktu: schema.platformAdminLogs.dibuatPada,
      aksi: schema.platformAdminLogs.aksi,
      detail: schema.platformAdminLogs.detail,
      admin: users.nama,
      organizationId: schema.platformAdminLogs.organizationId,
      namaKos: organizations.namaKos,
    })
    .from(schema.platformAdminLogs)
    .leftJoin(users, eq(users.id, schema.platformAdminLogs.adminUserId))
    .leftJoin(organizations, eq(organizations.id, schema.platformAdminLogs.organizationId))
    .orderBy(desc(schema.platformAdminLogs.dibuatPada))
    .limit(batas);
}
