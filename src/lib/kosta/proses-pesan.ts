// Orkestrator Kosta: pesan owner → cocokkan nomor & kos → pahami intent → jalankan tool → balasan.
// Balasan disimpan di riwayat (wa_messages) dan, untuk saluran WhatsApp, dikirim lewat adapter WA.
// Semua angka berasal dari tool (database); LLM hanya memilih intent. Setiap pesan yang diproses
// dicatat di audit Kosta (kosta_audit_logs), termasuk yang ditolak atau gagal.

import { eq } from "drizzle-orm";

import { schema, type Db } from "../../db/index.ts";
import { GalatAksi } from "../aksi/galat.ts";
import type { PengirimWhatsApp } from "../whatsapp/index.ts";
import { kirimDanCatat } from "../whatsapp/log.ts";
import type { PesanKosta, WorkspaceRingkas } from "@/lib/types";
import { catatAuditKosta, INTENT_KANONIK, type EntriAudit } from "./audit.ts";
import { batalkanDraft, cariDraftDenganKode, draftMenungguTerakhir, putuskanDraft } from "./draft.ts";
import { formatWhatsApp, TEKS_BANTUAN } from "./format-balasan.ts";
import { mintaTandaiLunas } from "./intent.ts";
import { kodeAksi } from "./kode-aksi.ts";
import type { ParserLlm } from "./llm.ts";
import { catatPesan } from "./riwayat.ts";
import { pahamiPesan, ruteTool } from "./router.ts";
import { toolDraftTagihan, toolKoreksiDraft, toolSiapkanKeluar, toolSiapkanPindah, toolSiapkanReminder } from "./tool-aksi.ts";
import { toolCekKamar, toolKamarKosong, toolRekapPemasukan, toolTunggakan, type BalasanKosta } from "./tool-baca.ts";
import { cariPilihanWorkspace, cocokkanNomorWa, pilihWorkspace } from "./workspace.ts";

const { waConversations, waMessages } = schema;

export type DepsKosta = {
  wa: PengirimWhatsApp;
  llm?: ParserLlm | null;
  baseUrl: string;
  hariIni: string;
  /** Waktu sekarang untuk batas berlaku preview; kosong = jam server (diisi di uji). */
  sekarang?: Date;
};

const daftarKos = (workspaces: WorkspaceRingkas[]) =>
  [
    "Kamu mengelola beberapa kos. Balas nomor atau nama kos yang mau dibahas:",
    ...workspaces.map((w, i) => `${i + 1}. ${w.namaKos} (${w.jumlahKamar} kamar)`),
  ].join("\n");

export const TOLAK_TANDAI_LUNAS =
  "Kosta tidak bisa menandai tagihan lunas dari chat, bukti transfer, atau pengakuan penyewa. Status Lunas hanya berubah otomatis saat pembayaran terverifikasi oleh payment gateway.";

export const kosDipilih = (w: WorkspaceRingkas) =>
  `Oke, sekarang aku bantu untuk ${w.namaKos} (${w.jumlahKamar} kamar). Data kos lain tidak ikut dibaca.`;

/** Jejak pemrosesan satu pesan untuk audit — diisi bertahap supaya pesan yang gagal pun tercatat. */
type Jejak = Omit<EntriAudit, "saluran" | "idPesanMasuk">;

/** Susun balasan untuk satu pesan (tanpa menyimpan/mengirim). */
async function susunBalasan(
  db: Db,
  { conversationId, messageId, teks }: { conversationId: string; messageId?: string; teks: string },
  deps: DepsKosta,
  jejak: Jejak,
): Promise<{ balasan: BalasanKosta; organizationId: string | null; namaKos?: string }> {
  const konteks = await cocokkanNomorWa(db, conversationId);
  jejak.statusPengirim = konteks.status;
  if (konteks.status !== "tidak_dikenal") jejak.actorUserId = konteks.userId;
  if (konteks.status === "tidak_dikenal" || konteks.status === "tanpa_akses") jejak.hasil = "ditolak";
  if (konteks.status === "tidak_dikenal") {
    return {
      organizationId: null,
      balasan: { teks: "Nomor ini belum terdaftar di Kostera. Tautkan nomor WhatsApp-mu lewat aplikasi Kostera dulu, ya." },
    };
  }
  if (konteks.status === "tanpa_akses") {
    return {
      organizationId: null,
      balasan: { teks: "Kosta hanya melayani pemilik atau admin kos. Untuk tagihanmu, buka link invoice yang dikirim pemilik kos." },
    };
  }
  if (konteks.status === "pilih_workspace") {
    const pilihan = cariPilihanWorkspace(teks, konteks.workspaces);
    const dipilih = pilihan && (await pilihWorkspace(db, conversationId, pilihan.id));
    Object.assign(
      jejak,
      dipilih
        ? { organizationId: dipilih.workspace.id, intent: "select_organization", tool: "pilihWorkspace", hasil: "dijawab" }
        : { hasil: "klarifikasi" },
    );
    return dipilih
      ? { organizationId: dipilih.workspace.id, balasan: { teks: kosDipilih(dipilih.workspace) } }
      : { organizationId: null, balasan: { teks: daftarKos(konteks.workspaces) } };
  }

  const { workspace, userId, workspaces } = konteks;
  const organizationId = workspace.id;
  jejak.organizationId = organizationId;
  if (mintaTandaiLunas(teks)) {
    Object.assign(jejak, { intent: "mark_invoice_paid", hasil: "ditolak" });
    return { organizationId, balasan: { teks: TOLAK_TANDAI_LUNAS } };
  }
  const { intent } = await pahamiPesan(teks, { hariIni: deps.hariIni, namaKos: workspace.namaKos, llm: deps.llm });
  if (messageId) await db.update(waMessages).set({ intent: intent.intent }).where(eq(waMessages.id, messageId));
  Object.assign(jejak, { intent: INTENT_KANONIK[intent.intent], tool: intent.intent, payload: { ...intent } });

  const pemilik = { organizationId, userId, conversationId };
  const percakapan = { organizationId, conversationId };
  const { hariIni } = deps;
  const balasan = await ruteTool<BalasanKosta>(
    intent,
    {
      lihat_tunggakan: (i) => toolTunggakan(db, organizationId, { periode: i.periode, hariIni }),
      kamar_kosong: () => toolKamarKosong(db, organizationId, { hariIni }),
      rekap_pemasukan: (i) => toolRekapPemasukan(db, organizationId, { periode: i.periode, rentang: i.rentang, hariIni }),
      cek_kamar: (i) => toolCekKamar(db, organizationId, { nomorKamar: i.nomorKamar, periode: i.periode, hariIni }),
      draft_tagihan: (i) => toolDraftTagihan(db, pemilik, { periode: i.periode, hariIni }),
      siapkan_reminder: (i) => toolSiapkanReminder(db, pemilik, { kamar: i.kamar, hariIni, sekarang: deps.sekarang }),
      koreksi_draft: (i) =>
        toolKoreksiDraft(db, percakapan, { kecualikan: i.kecualikan, nominal: i.nominal, tanggalJatuhTempo: i.tanggalJatuhTempo }),
      konfirmasi: async ({ setuju, kode }) => {
        let draftId: string;
        if (kode) {
          const draft = await cariDraftDenganKode(db, conversationId, organizationId, kode);
          if (!draft || draft.status !== "menunggu_konfirmasi") {
            jejak.hasil = "ditolak";
            if (draft) Object.assign(jejak, { actionId: draft.id, statusKonfirmasi: draft.status });
            return {
              teks: draft
                ? `Aksi ${kode} sudah ${draft.status} sebelumnya, jadi tidak dijalankan lagi.`
                : `Kode aksi ${kode} tidak ditemukan. Cek lagi kodenya di preview terakhir.`,
            };
          }
          draftId = draft.id;
        } else {
          const menunggu = await draftMenungguTerakhir(db, conversationId, organizationId);
          if (!menunggu) return { teks: "Tidak ada preview yang sedang menunggu konfirmasi." };
          // Menyetujui wajib dengan kode aksi; membatalkan tanpa kode aman (tidak ada yang diubah).
          if (setuju) {
            Object.assign(jejak, { actionId: menunggu, statusKonfirmasi: "menunggu_konfirmasi" });
            const k = kodeAksi(menunggu);
            return { teks: `Supaya tidak salah aksi, balas dengan kodenya: *YA ${k}* untuk menjalankan, atau *BATAL ${k}*.` };
          }
          draftId = menunggu;
        }
        jejak.actionId = draftId;
        const hasil = setuju
          ? await putuskanDraft(db, { draftId, organizationId, keputusan: "setuju" }, deps)
          : await batalkanDraft(db, { draftId, organizationId, sekarang: deps.sekarang });
        Object.assign(jejak, {
          statusKonfirmasi: hasil.kedaluwarsa ? "kedaluwarsa" : hasil.status,
          hasil: hasil.status === "dijalankan" ? "dijalankan" : hasil.gagal ? "ditolak" : "dibatalkan",
        });
        return { teks: hasil.balasan };
      },
      ganti_kos: async () => {
        if (workspaces.length < 2) return { teks: `Kamu hanya mengelola ${workspace.namaKos}.` };
        await db.update(waConversations).set({ organizationId: null }).where(eq(waConversations.id, conversationId));
        return { teks: daftarKos(workspaces) };
      },
      pindah_penghuni: (i) => toolSiapkanPindah(db, pemilik, { ...i, hariIni }),
      keluar_penghuni: (i) => toolSiapkanKeluar(db, pemilik, { ...i, hariIni }),
    },
    async () => ({ teks: TEKS_BANTUAN }),
  );
  // Hasil belum ditentukan handler (hanya konfirmasi yang menentukannya sendiri) → baca dari balasan.
  if (jejak.hasil === "galat") {
    const preview = balasan.lampiran?.jenis === "preview_aksi" ? balasan.lampiran : null;
    if (preview) Object.assign(jejak, { hasil: "menunggu_konfirmasi", actionId: preview.draftId, statusKonfirmasi: preview.status });
    else if (balasan.klarifikasi || ["bantuan", "konfirmasi", "ganti_kos"].includes(intent.intent)) jejak.hasil = "klarifikasi";
    else jejak.hasil = "dijawab";
  }
  return { balasan, organizationId, namaKos: workspace.namaKos };
}

/**
 * Proses satu pesan owner dan simpan balasan Kosta di riwayat. Saluran "whatsapp" juga mengirim
 * balasan (teks berformat WA) ke nomor percakapan; saluran "web" hanya mengembalikannya.
 */
export async function prosesPesanKosta(
  db: Db,
  pesan: { conversationId: string; messageId?: string; teks: string; saluran: "whatsapp" | "web" },
  deps: DepsKosta,
): Promise<PesanKosta> {
  let hasil: { balasan: BalasanKosta; organizationId: string | null; namaKos?: string };
  // "galat" sampai ada hasil — pesan yang gagal diproses tetap tercatat sebagai galat.
  const jejak: Jejak = { statusPengirim: "tidak_dikenal", hasil: "galat" };
  try {
    hasil = await susunBalasan(db, pesan, deps, jejak);
  } catch (err) {
    // Galat yang aman ditampilkan (mis. kamar tidak ada di draft) diteruskan; sisanya disamarkan.
    if (!(err instanceof GalatAksi)) console.error("Kosta gagal memproses pesan:", err);
    const [p] = await db
      .select({ organizationId: waConversations.organizationId })
      .from(waConversations)
      .where(eq(waConversations.id, pesan.conversationId));
    hasil = {
      organizationId: p?.organizationId ?? null,
      balasan: { teks: err instanceof GalatAksi ? err.message : "Maaf, ada kendala di sistem. Coba lagi sebentar lagi, ya." },
    };
    jejak.hasil = err instanceof GalatAksi ? "ditolak" : "galat";
  }
  await catatAuditKosta(db, { ...jejak, saluran: pesan.saluran, idPesanMasuk: pesan.messageId });

  const tersimpan = await catatPesan(db, {
    conversationId: pesan.conversationId,
    organizationId: hasil.organizationId,
    arah: "keluar",
    isi: hasil.balasan.teks,
    lampiran: hasil.balasan.lampiran,
  });

  if (pesan.saluran === "whatsapp") {
    const [p] = await db
      .select({ nomorWa: waConversations.nomorWa })
      .from(waConversations)
      .where(eq(waConversations.id, pesan.conversationId));
    const kirim = await kirimDanCatat(
      db,
      deps.wa,
      { ke: p.nomorWa, teks: formatWhatsApp(hasil.balasan, { namaKos: hasil.namaKos }) },
      { jenis: "kosta", organizationId: hasil.organizationId, referensiId: tersimpan.id },
    );
    if (!kirim.ok) console.error(`Balasan Kosta ke percakapan ${pesan.conversationId} gagal terkirim.`);
  }
  return tersimpan;
}
