// Skema database Kostera (PostgreSQL) — mengikuti bagian "Database Schema" di PRD.
// Nama kolom di database snake_case (casing diatur di klien Drizzle & drizzle.config.ts).
// Nominal selalu integer rupiah; status dibatasi enum supaya tetap deterministik.

import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

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
  (t) => [check("organizations_jumlah_kamar_positif", sql`${t.jumlahKamar} > 0`)],
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
  },
  (t) => [
    uniqueIndex("rooms_organisasi_nomor_unik").on(t.organizationId, t.nomorKamar),
    check("rooms_harga_sewa_positif", sql`${t.hargaSewa} > 0`),
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
  },
  (t) => [
    index("tenants_organisasi").on(t.organizationId),
    // Satu kamar hanya boleh punya satu penghuni aktif.
    uniqueIndex("tenants_kamar_aktif_unik").on(t.roomId).where(sql`${t.status} = 'aktif'`),
    check("tenants_harga_sewa_positif", sql`${t.hargaSewa} > 0`),
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
