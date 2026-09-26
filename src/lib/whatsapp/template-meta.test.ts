import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  TEMPLATE_LUNAS,
  TEMPLATE_PEMBAYARAN_MASUK,
  TEMPLATE_PENGINGAT,
  TEMPLATE_PERLU_REVIEW,
  TEMPLATE_TAGIHAN,
  TEMPLATE_TIKET,
} from "../pesan.ts";
import { cekTemplateMeta, daftarkanTemplateMeta, daftarTemplateMeta } from "./template-meta.ts";

const APP = "https://app.kostera.id";
// Nilai uji saja — bukan token sungguhan.
const TOKEN = "token-meta-uji-rahasia";

type Tombol = { type: string; text: string; url?: string; example?: string[] };
const komponen = (t: ReturnType<typeof daftarTemplateMeta>[number], tipe: string) =>
  t.components.find((c) => c.type === tipe) as Record<string, unknown> | undefined;

describe("template WhatsApp resmi (Meta)", () => {
  const templates = daftarTemplateMeta(APP);

  it("mencakup semua template yang dipakai aplikasi, termasuk kabar uang masuk & Perlu review ke owner", () => {
    assert.deepEqual(templates.map((t) => t.name).sort(), [
      "kostera_kode_otp",
      "kostera_pembayaran_diterima",
      "kostera_pembayaran_masuk",
      "kostera_pembayaran_perlu_dicek",
      "kostera_pengingat_lewat",
      "kostera_pengingat_sebelum",
      "kostera_tagihan_baru",
      "kostera_tiket_diperbarui",
    ]);
  });

  it("isi Utility sama persis dengan yang dikirim aplikasi; contoh variabel lengkap & berurutan; tombol valid", () => {
    const isiAsli: Record<string, string> = {
      [TEMPLATE_TAGIHAN.nama]: TEMPLATE_TAGIHAN.isi,
      [TEMPLATE_LUNAS.nama]: TEMPLATE_LUNAS.isi,
      [TEMPLATE_PENGINGAT.sebelum.nama]: TEMPLATE_PENGINGAT.sebelum.isi,
      [TEMPLATE_PENGINGAT.lewat.nama]: TEMPLATE_PENGINGAT.lewat.isi,
      [TEMPLATE_TIKET.nama]: TEMPLATE_TIKET.isi,
      [TEMPLATE_PERLU_REVIEW.nama]: TEMPLATE_PERLU_REVIEW.isi,
      [TEMPLATE_PEMBAYARAN_MASUK.nama]: TEMPLATE_PEMBAYARAN_MASUK.isi,
    };
    // Template untuk owner membuka dashboard (URL statis); untuk penyewa membuka invoice-nya.
    const tombolStatis: Record<string, string> = {
      [TEMPLATE_PERLU_REVIEW.nama]: `${APP}/pembayaran?status=perlu_review`,
      [TEMPLATE_PEMBAYARAN_MASUK.nama]: `${APP}/pembayaran`,
    };
    for (const t of templates.filter((x) => x.category === "UTILITY")) {
      const body = komponen(t, "BODY")!;
      assert.equal(body.text, isiAsli[t.name], t.name);
      const nomor = [...new Set([...(body.text as string).matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])))];
      assert.deepEqual(nomor, nomor.map((_, i) => i + 1), `${t.name}: variabel harus {{1}}..{{n}} berurutan`);
      const [contoh] = (body.example as { body_text: string[][] }).body_text;
      assert.equal(contoh.length, nomor.length, `${t.name}: jumlah contoh variabel`);
      assert.ok(contoh.every((v) => v.trim().length > 0), t.name);
      assert.ok((body.text as string).length <= 1024, t.name);

      const [tombol] = (komponen(t, "BUTTONS")!.buttons as Tombol[]);
      assert.equal(tombol.type, "URL");
      assert.ok(tombol.text.length <= 25, t.name);
      if (tombolStatis[t.name]) {
        assert.equal(tombol.url, tombolStatis[t.name]);
        assert.equal(tombol.example, undefined);
      } else {
        assert.equal(tombol.url, `${APP}/invoice/{{1}}`);
        assert.equal(tombol.example?.length, 1);
        assert.ok(tombol.example![0].startsWith(`${APP}/invoice/`), t.name);
      }
    }
  });

  it("OTP memakai template Authentication baku: saran keamanan, masa berlaku 5 menit, tombol salin kode", () => {
    const otp = templates.find((t) => t.name === "kostera_kode_otp")!;
    assert.equal(otp.category, "AUTHENTICATION");
    assert.deepEqual(otp.components, [
      { type: "BODY", add_security_recommendation: true },
      { type: "FOOTER", code_expiration_minutes: 5 },
      { type: "BUTTONS", buttons: [{ type: "OTP", otp_type: "COPY_CODE", text: "Salin kode" }] },
    ]);
  });

  it("daftar: POST tiap template ke WABA; hasil per template tanpa pernah memuat token", async () => {
    const permintaan: { url: string; method?: string; auth?: string; nama: string }[] = [];
    const palsu = (async (url: string, init?: RequestInit) => {
      const nama = JSON.parse(String(init?.body)).name as string;
      permintaan.push({ url, method: init?.method, auth: (init?.headers as Record<string, string>).Authorization, nama });
      return nama === "kostera_kode_otp"
        ? Response.json({ error: { message: "Template name already exists", error_user_msg: "Nama template sudah dipakai" } }, { status: 400 })
        : Response.json({ id: "123", status: "PENDING", category: "UTILITY" });
    }) as typeof fetch;
    const hasil = await daftarkanTemplateMeta({ token: TOKEN, wabaId: "WABA123", fetch: palsu }, templates);
    assert.equal(permintaan.length, 8);
    assert.ok(permintaan.every((p) => p.url === "https://graph.facebook.com/v23.0/WABA123/message_templates" && p.method === "POST"));
    assert.ok(permintaan.every((p) => p.auth === `Bearer ${TOKEN}`));
    assert.equal(hasil.filter((b) => b.startsWith("✓") && b.endsWith("PENDING")).length, 7);
    assert.ok(hasil.includes("✗ kostera_kode_otp → Meta: Nama template sudah dipakai"));
    assert.ok(!hasil.join("\n").includes(TOKEN));
  });

  it("cek: status tiap template; yang belum disetujui atau belum ada ditandai", async () => {
    const palsu = (async () =>
      Response.json({
        data: [
          ...templates.filter((t) => t.name !== "kostera_pembayaran_perlu_dicek").map((t) => ({ name: t.name, status: "APPROVED", language: "id" })),
          { name: "kostera_tagihan_baru", status: "REJECTED", language: "en" },
        ],
      })) as typeof fetch;
    const hasil = await cekTemplateMeta({ token: TOKEN, wabaId: "WABA123", fetch: palsu }, templates);
    assert.equal(hasil.filter((b) => b.startsWith("✓")).length, 7);
    assert.ok(hasil.includes("✗ kostera_pembayaran_perlu_dicek → belum didaftarkan"));
  });
});
