// Audit Kosta (tabel kosta_audit_logs): setiap pesan owner yang diproses dan setiap keputusan aksi
// dicatat — pesan masuk, aktor, kos, intent kanonik, tool, action ID, status konfirmasi, hasil.
// Payload hanya parameter intent yang disaring (tanpa isi pesan mentah, nomor, atau nama penyewa).

import { schema, type Db } from "../../db/index.ts";
import type { NamaIntent } from "./intent.ts";

/** Nama intent kanonik untuk audit & laporan; nama internal tetap dipakai parser dan tool. */
export const INTENT_KANONIK = {
  lihat_tunggakan: "list_arrears",
  kamar_kosong: "get_room_availability",
  rekap_pemasukan: "get_income_summary",
  cek_kamar: "get_room_status",
  draft_tagihan: "prepare_invoice_generation",
  siapkan_reminder: "prepare_reminder",
  pindah_penghuni: "prepare_tenant_move",
  keluar_penghuni: "prepare_tenant_move",
  koreksi_draft: "revise_action",
  konfirmasi: "confirm_action",
  ganti_kos: "switch_organization",
  bantuan: "help",
} as const satisfies Record<NamaIntent, string>;

export type SaluranAudit = "whatsapp" | "web" | "dashboard" | "sistem";
export type StatusPengirim = "tidak_dikenal" | "tanpa_akses" | "pilih_workspace" | "siap";
export type HasilAudit =
  | "dijawab"
  | "klarifikasi"
  | "menunggu_konfirmasi"
  | "dijalankan"
  | "dibatalkan"
  | "ditolak"
  | "galat";

export type EntriAudit = {
  saluran: SaluranAudit;
  statusPengirim: StatusPengirim;
  hasil: HasilAudit;
  idPesanMasuk?: string | null;
  organizationId?: string | null;
  actorUserId?: string | null;
  /** Nama kanonik (lihat INTENT_KANONIK) atau aksi lain, mis. "select_organization". */
  intent?: string | null;
  tool?: string | null;
  payload?: Record<string, unknown>;
  actionId?: string | null;
  statusKonfirmasi?: string | null;
};

/** Parameter intent yang boleh masuk audit; nilai lain dibuang. */
const KUNCI_PAYLOAD = new Set([
  "periode",
  "nomorKamar",
  "dariKamar",
  "keKamar",
  "kecualikan",
  "nominal",
  "tanggalJatuhTempo",
  "setuju",
  "kode",
  "kamar",
  "rentang",
  "tanggal",
]);

const saringNilai = (nilai: unknown): unknown => {
  if (typeof nilai === "string") return nilai.slice(0, 40);
  if (typeof nilai === "number" || typeof nilai === "boolean") return nilai;
  if (Array.isArray(nilai)) return nilai.slice(0, 50).map(saringNilai);
  if (nilai && typeof nilai === "object") {
    return Object.fromEntries(Object.entries(nilai).filter(([k]) => KUNCI_PAYLOAD.has(k)).map(([k, v]) => [k, saringNilai(v)]));
  }
  return null;
};

/** Ambil parameter intent yang aman untuk audit (tanpa teks bebas). */
export function saringPayload(parameter: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(parameter)
      .filter(([k, v]) => KUNCI_PAYLOAD.has(k) && v !== undefined)
      .map(([k, v]) => [k, saringNilai(v)]),
  );
}

/** Catat satu entri audit. Gagal mencatat tidak membatalkan balasan ke owner (dicatat ke log server). */
export async function catatAuditKosta(db: Pick<Db, "insert">, e: EntriAudit) {
  try {
    await db.insert(schema.kostaAuditLogs).values({
      saluran: e.saluran,
      statusPengirim: e.statusPengirim,
      hasil: e.hasil,
      idPesanMasuk: e.idPesanMasuk ?? null,
      organizationId: e.organizationId ?? null,
      actorUserId: e.actorUserId ?? null,
      intent: e.intent ?? null,
      tool: e.tool ?? null,
      payload: e.payload ? saringPayload(e.payload) : {},
      actionId: e.actionId ?? null,
      statusKonfirmasi: e.statusKonfirmasi ?? null,
    });
  } catch (err) {
    console.error(`[kosta] audit ${e.intent ?? e.statusPengirim} gagal dicatat:`, err);
  }
}
