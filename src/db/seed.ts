// Isi data contoh Kos Melati (sama dengan data tiruan tahap frontend) ke database.
// Pakai: npm run db:seed. Aman diulang — dilewati bila Kos Melati sudah ada.

import { pathToFileURL } from "node:url";

import { eq } from "drizzle-orm";

import {
  mockInvoices,
  mockOrganization,
  mockOwner,
  mockPayments,
  mockPenghuniKeluar,
  mockReminders,
  mockRooms,
  mockTenants,
} from "../lib/mock/kos-melati.ts";
import { mockPemilikLain, mockPercakapanKosta, mockWorkspaceLain } from "../lib/mock/kosta.ts";
import { getDb, tutupDb, type Db } from "./index.ts";
import * as schema from "./schema.ts";

/** Tanggal kalender → awal hari itu dalam WIB. */
const awalHariWib = (tanggal: string) => new Date(`${tanggal}T00:00:00+07:00`);

/** Mengembalikan true bila data contoh baru saja ditambahkan. */
export async function isiDataContoh(db: Db) {
  const [ada] = await db
    .select({ id: schema.organizations.id })
    .from(schema.organizations)
    .where(eq(schema.organizations.id, mockOrganization.id));
  if (ada) return false;

  // Invoice lunas dibayar tepat saat pembayaran valid-nya diverifikasi gateway.
  const dibayarPada = new Map(
    mockPayments
      .filter((p) => p.status === "valid")
      .map((p) => [p.invoiceId, new Date(p.diverifikasiPada)]),
  );

  await db.transaction(async (tx) => {
    await tx.insert(schema.users).values({
      id: mockOwner.id,
      nama: mockOwner.nama,
      nomorWa: mockOwner.nomorWa,
      nomorWaTerverifikasi: true,
    });
    await tx.insert(schema.organizations).values({ ...mockOrganization, ownerId: mockOwner.id });
    await tx.insert(schema.members).values({
      organizationId: mockOrganization.id,
      userId: mockOwner.id,
      peran: "owner",
    });
    await tx.insert(schema.rooms).values(mockRooms);
    await tx.insert(schema.tenants).values([...mockTenants, ...mockPenghuniKeluar]);
    await tx.insert(schema.riwayatHunian).values(
      [...mockTenants, ...mockPenghuniKeluar].map((t) => ({
        organizationId: t.organizationId,
        tenantId: t.id,
        roomId: t.roomId,
        tanggalMulai: t.tanggalMasuk,
        tanggalSelesai: t.tanggalKeluar ?? null,
        hargaSewa: t.hargaSewa,
        alasanSelesai: t.status === "keluar" ? "keluar" : null,
      })),
    );
    await tx.insert(schema.invoices).values(
      mockInvoices.map((inv) => ({
        ...inv,
        diterbitkanPada: awalHariWib(inv.diterbitkanPada),
        dibayarPada: dibayarPada.get(inv.id) ?? null,
      })),
    );
    await tx.insert(schema.invoiceItems).values(
      mockInvoices.map((inv) => ({ invoiceId: inv.id, label: "Sewa kamar", nominal: inv.nominal })),
    );
    await tx.insert(schema.payments).values(
      mockPayments.map((p) => ({
        ...p,
        diverifikasiPada: new Date(p.diverifikasiPada),
        dibuatPada: new Date(p.diverifikasiPada),
      })),
    );

    await tx.insert(schema.reminders).values(mockReminders.map((r) => ({ ...r, terkirimPada: new Date(r.terkirimPada) })));

    // Kos lain yang juga dikelola owner contoh (sebagai owner / admin) — untuk pemilih workspace.
    await tx.insert(schema.users).values({ ...mockPemilikLain, nomorWaTerverifikasi: true });
    for (const ws of mockWorkspaceLain) {
      const ownerId = ws.peran === "owner" ? mockOwner.id : mockPemilikLain.id;
      await tx.insert(schema.organizations).values({ id: ws.id, namaKos: ws.namaKos, jumlahKamar: ws.jumlahKamar, ownerId });
      await tx.insert(schema.members).values([
        { organizationId: ws.id, userId: ownerId, peran: "owner" },
        ...(ws.peran === "admin" ? [{ organizationId: ws.id, userId: mockOwner.id, peran: "admin" as const }] : []),
      ]);
    }

    // Percakapan owner dengan Kosta, berakhir dengan preview pengingat yang menunggu konfirmasi.
    const percakapan = { id: "wac_owner_kos_melati", organizationId: mockOrganization.id };
    await tx.insert(schema.waConversations).values({
      ...percakapan,
      nomorWa: mockOwner.nomorWa,
      userId: mockOwner.id,
      terakhirPesanPada: new Date(mockPercakapanKosta.at(-1)!.waktu),
    });
    const idDraft = (l: { aksi: string; periode: string }) => `draft_${l.aksi}_${l.periode}`;
    await tx.insert(schema.waMessages).values(
      mockPercakapanKosta.map((p) => ({
        id: `msg_${p.id}`,
        conversationId: percakapan.id,
        organizationId: percakapan.organizationId,
        arah: p.dari === "owner" ? ("masuk" as const) : ("keluar" as const),
        isi: p.teks,
        lampiran:
          p.lampiran?.jenis === "preview_aksi" ? { ...p.lampiran, draftId: idDraft(p.lampiran) } : (p.lampiran ?? null),
        dibuatPada: new Date(p.waktu),
      })),
    );
    const pesanPreview = mockPercakapanKosta.findLast((p) => p.lampiran?.jenis === "preview_aksi");
    if (pesanPreview?.lampiran?.jenis === "preview_aksi") {
      const { aksi, periode, penerima, total } = pesanPreview.lampiran;
      await tx.insert(schema.actionDrafts).values({
        id: idDraft(pesanPreview.lampiran),
        organizationId: percakapan.organizationId,
        userId: mockOwner.id,
        conversationId: percakapan.id,
        jenisAksi: aksi,
        // Pengingat untuk tagihan jatuh tempo kamar-kamar di preview.
        ringkasanPreview: { aksi, periode, penerima, total, invoiceIds: penerima.map((p) => `inv_${periode}_${p.nomorKamar}`) },
        dibuatPada: new Date(pesanPreview.waktu),
      });
    }
  });
  return true;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    const baru = await isiDataContoh(await getDb());
    console.log(baru ? "✓ Data contoh Kos Melati ditambahkan" : "• Data contoh Kos Melati sudah ada, dilewati");
  } finally {
    await tutupDb();
  }
}
