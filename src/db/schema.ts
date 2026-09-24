// Skema database Kostera (PostgreSQL) — mengikuti bagian "Database Schema" di PRD.
// Nama kolom di database snake_case (casing diatur di klien Drizzle & drizzle.config.ts).
// Nominal selalu integer rupiah; status dibatasi enum supaya tetap deterministik.

import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import type { DataDraftAksi, LampiranKosta } from "@/lib/types";

const id = () =>
  text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const waktu = () => timestamp({ withTimezone: true, mode: "date" });

export const peranEnum = pgEnum("peran", ["owner", "admin", "penyewa"]);
export const statusMemberEnum = pgEnum("status_member", ["aktif", "nonaktif"]);
export const statusKamarEnum = pgEnum("status_kamar", ["terisi", "kosong"]);
export const statusPenghuniEnum = pgEnum("status_penghuni", ["aktif", "keluar"]);
export const statusInvoiceEnum = pgEnum("status_invoice", [
  "draft",
  "terkirim",
  "menunggu",
  "lunas",
  "jatuh_tempo",
  "perlu_review",
]);
export const statusPembayaranEnum = pgEnum("status_pembayaran", [
  "pending",
  "valid",
  "tidak_cocok",
]);
export const statusReminderEnum = pgEnum("status_reminder", ["terkirim", "gagal"]);
export const aturanJatuhTempoEnum = pgEnum("aturan_jatuh_tempo", ["tanggal_masuk", "tanggal_tetap"]);
export const arahPesanEnum = pgEnum("arah_pesan", ["masuk", "keluar"]);
export const jenisAksiEnum = pgEnum("jenis_aksi", ["reminder", "tagihan"]);
export const statusDraftAksiEnum = pgEnum("status_draft_aksi", [
  "menunggu_konfirmasi",
  "disetujui",
  "dibatalkan",
  "dijalankan",
]);

export const users = pgTable("users", {
  id: id(),
  nama: text().notNull(),
  nomorWa: text().notNull().unique("users_nomor_wa_unik"),
  nomorWaTerverifikasi: boolean().notNull().default(false),
  email: text(),
});

export const organizations = pgTable(
  "organizations",
  {
    id: id(),
    namaKos: text().notNull(),
    alamat: text().notNull().default(""),
    jumlahKamar: integer().notNull(),
    ownerId: text()
      .notNull()
      .references(() => users.id),
    dibuatPada: waktu().notNull().defaultNow(),
  },
  (t) => [check("organizations_jumlah_kamar_tidak_negatif", sql`${t.jumlahKamar} >= 0`)],
);

export const members = pgTable(
  "members",
  {
    id: id(),
    organizationId: text()
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    peran: peranEnum().notNull(),
    status: statusMemberEnum().notNull().default("aktif"),
    dibuatPada: waktu().notNull().defaultNow(),
  },
  (t) => [uniqueIndex("members_organisasi_user_unik").on(t.organizationId, t.userId)],
);

export const rooms = pgTable(
  "rooms",
  {
    id: id(),
    organizationId: text()
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    nomorKamar: text().notNull(),
    tipe: text().notNull(),
    hargaSewa: integer().notNull(),
    status: statusKamarEnum().notNull().default("kosong"),
    catatan: text(),
    /** false = dinonaktifkan (mis. renovasi): tidak dihitung, tidak bisa diisi; riwayat tetap ada. */
    aktif: boolean().notNull().default(true),
  },
  (t) => [
    uniqueIndex("rooms_organisasi_nomor_unik").on(t.organizationId, t.nomorKamar),
    check("rooms_harga_sewa_positif", sql`${t.hargaSewa} > 0`),
    // Hanya kamar kosong yang boleh dinonaktifkan.
    check("rooms_nonaktif_kosong", sql`${t.aktif} or ${t.status} = 'kosong'`),
  ],
);

export const tenants = pgTable(
  "tenants",
  {
    id: id(),
    organizationId: text()
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text().references(() => users.id),
    nama: text().notNull(),
    nomorWa: text().notNull(),
    roomId: text()
      .notNull()
      .references(() => rooms.id),
    tanggalMasuk: date({ mode: "string" }).notNull(),
    tanggalKeluar: date({ mode: "string" }),
    status: statusPenghuniEnum().notNull().default("aktif"),
    hargaSewa: integer().notNull(),
    alasanKeluar: text(),
  },
  (t) => [
    index("tenants_organisasi").on(t.organizationId),
    // Satu kamar hanya boleh punya satu penghuni aktif.
    uniqueIndex("tenants_kamar_aktif_unik").on(t.roomId).where(sql`${t.status} = 'aktif'`),
    check("tenants_harga_sewa_positif", sql`${t.hargaSewa} > 0`),
    check("tenants_keluar_bertanggal", sql`${t.status} = 'aktif' or ${t.tanggalKeluar} is not null`),
    check("tenants_tanggal_keluar_urut", sql`${t.tanggalKeluar} is null or ${t.tanggalKeluar} >= ${t.tanggalMasuk}`),
  ],
);

/**
 * Riwayat penempatan penghuni per kamar (masuk, pindah, keluar). Satu penghuni hanya punya satu
 * hunian berjalan (tanggal selesai kosong). Dipakai untuk riwayat kamar & "kosong sejak".
 */
export const riwayatHunian = pgTable(
  "riwayat_hunian",
  {
    id: id(),
    organizationId: text()
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    tenantId: text()
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    roomId: text()
      .notNull()
      .references(() => rooms.id),
    tanggalMulai: date({ mode: "string" }).notNull(),
    tanggalSelesai: date({ mode: "string" }),
    hargaSewa: integer().notNull(),
    /** Alasan hunian berakhir: "pindah" atau "keluar" (+ keterangan). */
    alasanSelesai: text(),
  },
  (t) => [
    index("riwayat_hunian_kamar").on(t.roomId, t.tanggalSelesai),
    uniqueIndex("riwayat_hunian_berjalan_unik").on(t.tenantId).where(sql`${t.tanggalSelesai} is null`),
    check("riwayat_hunian_harga_positif", sql`${t.hargaSewa} > 0`),
    check("riwayat_hunian_tanggal_urut", sql`${t.tanggalSelesai} is null or ${t.tanggalSelesai} >= ${t.tanggalMulai}`),
  ],
);

export const invoices = pgTable(
  "invoices",
  {
    id: id(),
    organizationId: text()
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    tenantId: text()
      .notNull()
      .references(() => tenants.id),
    roomId: text()
      .notNull()
      .references(() => rooms.id),
    /** Format YYYY-MM */
    periode: text().notNull(),
    nominal: integer().notNull(),
    jatuhTempo: date({ mode: "string" }).notNull(),
    status: statusInvoiceEnum().notNull().default("draft"),
    tokenPublik: text().notNull().unique("invoices_token_publik_unik"),
    diterbitkanPada: waktu().notNull().defaultNow(),
    dibayarPada: waktu(),
  },
  (t) => [
    index("invoices_organisasi_periode").on(t.organizationId, t.periode),
    // Satu tagihan sewa per penghuni per periode — mencegah tagihan ganda.
    uniqueIndex("invoices_penghuni_periode_unik").on(t.tenantId, t.periode),
    check("invoices_nominal_positif", sql`${t.nominal} > 0`),
    check("invoices_format_periode", sql`${t.periode} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`),
  ],
);

/** Rincian komponen tagihan (Sewa, Listrik, Air…); totalnya sama dengan nominal invoice. */
export const invoiceItems = pgTable(
  "invoice_items",
  {
    id: id(),
    invoiceId: text()
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    label: text().notNull(),
    nominal: integer().notNull(),
  },
  (t) => [
    index("invoice_items_invoice").on(t.invoiceId),
    check("invoice_items_nominal_positif", sql`${t.nominal} > 0`),
  ],
);

/** Pengaturan tagihan terjadwal bulanan — paling banyak satu baris per organisasi. */
export const invoiceSchedules = pgTable(
  "invoice_schedules",
  {
    id: id(),
    organizationId: text()
      .notNull()
      .unique("invoice_schedules_organisasi_unik")
      .references(() => organizations.id, { onDelete: "cascade" }),
    aktif: boolean().notNull().default(false),
    /** Tanggal terbit tiap bulan (WIB). */
    tanggalTerbit: integer().notNull().default(1),
    aturanJatuhTempo: aturanJatuhTempoEnum().notNull().default("tanggal_masuk"),
    /** Hanya untuk aturan tanggal_tetap. */
    tanggalJatuhTempo: integer(),
    diperbaruiPada: waktu().notNull().defaultNow(),
  },
  (t) => [
    check("invoice_schedules_tanggal_terbit", sql`${t.tanggalTerbit} between 1 and 28`),
    check(
      "invoice_schedules_tanggal_jatuh_tempo",
      sql`(${t.aturanJatuhTempo} = 'tanggal_masuk' and ${t.tanggalJatuhTempo} is null)
        or (${t.aturanJatuhTempo} = 'tanggal_tetap' and ${t.tanggalJatuhTempo} is not null
          and ${t.tanggalJatuhTempo} between 1 and 28)`,
    ),
  ],
);

/**
 * Notifikasi webhook payment gateway — jaminan idempotensi: event yang sama (provider + event_id)
 * hanya tercatat & diproses sekali. `hasil` merekam keputusan pemrosesan untuk audit.
 */
export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: id(),
    provider: text().notNull(),
    eventId: text().notNull(),
    payload: jsonb().$type<Record<string, unknown>>().notNull(),
    diterimaPada: waktu().notNull().defaultNow(),
    diprosesPada: waktu(),
    /** Mis. "lunas", "perlu_review", "diabaikan: invoice tidak ditemukan". */
    hasil: text(),
  },
  (t) => [uniqueIndex("webhook_events_provider_event_unik").on(t.provider, t.eventId)],
);

export const payments = pgTable(
  "payments",
  {
    id: id(),
    invoiceId: text()
      .notNull()
      .references(() => invoices.id),
    nominalDibayar: integer().notNull(),
    metode: text().notNull(),
    provider: text().notNull(),
    referensiProvider: text().notNull().unique("payments_referensi_provider_unik"),
    status: statusPembayaranEnum().notNull().default("pending"),
    /** Waktu verifikasi webhook gateway. */
    diverifikasiPada: waktu(),
    /** Notifikasi gateway yang mencatat pembayaran ini. */
    webhookEventId: text()
      .unique("payments_webhook_event_unik")
      .references(() => webhookEvents.id),
    dibuatPada: waktu().notNull().defaultNow(),
  },
  (t) => [
    index("payments_invoice").on(t.invoiceId),
    check("payments_nominal_positif", sql`${t.nominalDibayar} > 0`),
  ],
);

export const reminders = pgTable(
  "reminders",
  {
    id: id(),
    organizationId: text()
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    invoiceId: text()
      .notNull()
      .references(() => invoices.id),
    tenantId: text()
      .notNull()
      .references(() => tenants.id),
    /** "manual" dari dashboard, atau jadwal otomatis: "H-3" / "H" / "H+3". */
    jenis: text().notNull(),
    kanal: text().notNull().default("whatsapp"),
    status: statusReminderEnum().notNull(),
    terkirimPada: waktu().notNull().defaultNow(),
  },
  (t) => [index("reminders_invoice").on(t.invoiceId)],
);

/**
 * Percakapan WhatsApp dengan Kosta — satu per nomor WA. `userId` kosong = nomor belum tertaut/terverifikasi
 * (tidak boleh membaca data kos mana pun). `organizationId` = kos yang sedang dibahas (workspace aktif);
 * FK gabungan ke members menjamin kos itu memang milik/dikelola pengguna tersebut.
 */
export const waConversations = pgTable(
  "wa_conversations",
  {
    id: id(),
    nomorWa: text().notNull().unique("wa_conversations_nomor_wa_unik"),
    userId: text().references(() => users.id, { onDelete: "cascade" }),
    organizationId: text(),
    terakhirPesanPada: waktu(),
    dibuatPada: waktu().notNull().defaultNow(),
  },
  (t) => [
    // Di migrasi: ON DELETE SET NULL ("organization_id") — keluar dari kos hanya mengosongkan
    // workspace aktif, tautan nomor ke pengguna tetap.
    foreignKey({
      name: "wa_conversations_workspace_anggota_fk",
      columns: [t.organizationId, t.userId],
      foreignColumns: [members.organizationId, members.userId],
    }).onDelete("set null"),
    check("wa_conversations_workspace_butuh_user", sql`${t.organizationId} is null or ${t.userId} is not null`),
  ],
);

/** Isi percakapan. Angka di `lampiran` selalu dari database, bukan buatan AI. */
export const waMessages = pgTable(
  "wa_messages",
  {
    id: id(),
    conversationId: text()
      .notNull()
      .references(() => waConversations.id, { onDelete: "cascade" }),
    /** Kos yang dibahas saat pesan ini diproses. */
    organizationId: text().references(() => organizations.id, { onDelete: "set null" }),
    arah: arahPesanEnum().notNull(),
    isi: text().notNull(),
    /** Hasil parsing pesan masuk, mis. "lihat_tunggakan". */
    intent: text(),
    lampiran: jsonb().$type<LampiranKosta>(),
    /** ID pesan dari provider WhatsApp — mencegah webhook yang sama tercatat dua kali. */
    idPesanProvider: text().unique("wa_messages_id_provider_unik"),
    dibuatPada: waktu().notNull().defaultNow(),
  },
  (t) => [index("wa_messages_percakapan_waktu").on(t.conversationId, t.dibuatPada)],
);

/** Draft aksi Kosta (ubah data / kirim massal) yang menunggu konfirmasi owner. */
export const actionDrafts = pgTable(
  "action_drafts",
  {
    id: id(),
    organizationId: text().notNull(),
    userId: text().notNull(),
    conversationId: text().references(() => waConversations.id, { onDelete: "set null" }),
    jenisAksi: jenisAksiEnum().notNull(),
    /** Penerima, periode, nominal yang ditampilkan ke owner saat minta konfirmasi. */
    ringkasanPreview: jsonb().$type<DataDraftAksi>().notNull(),
    status: statusDraftAksiEnum().notNull().default("menunggu_konfirmasi"),
    dibuatPada: waktu().notNull().defaultNow(),
    dikonfirmasiPada: waktu(),
  },
  (t) => [
    // Draft hanya bisa dibuat oleh anggota kos tersebut.
    foreignKey({
      name: "action_drafts_anggota_fk",
      columns: [t.organizationId, t.userId],
      foreignColumns: [members.organizationId, members.userId],
    }).onDelete("cascade"),
    index("action_drafts_organisasi_status").on(t.organizationId, t.status),
    check(
      "action_drafts_waktu_konfirmasi",
      sql`(${t.status} = 'menunggu_konfirmasi') = (${t.dikonfirmasiPada} is null)`,
    ),
  ],
);

/** Kode OTP untuk memverifikasi & menautkan nomor WhatsApp. Hanya hash kode yang disimpan. */
export const verifikasiWa = pgTable(
  "verifikasi_wa",
  {
    id: id(),
    nomorWa: text().notNull(),
    kodeHash: text().notNull(),
    kedaluwarsaPada: waktu().notNull(),
    percobaan: integer().notNull().default(0),
    terverifikasiPada: waktu(),
    dibuatPada: waktu().notNull().defaultNow(),
  },
  (t) => [
    index("verifikasi_wa_nomor").on(t.nomorWa, t.dibuatPada),
    check("verifikasi_wa_percobaan", sql`${t.percobaan} between 0 and 10`),
  ],
);
