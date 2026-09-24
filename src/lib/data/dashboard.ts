// Kontrak data halaman Dashboard Kos.
// Tahap frontend: dihitung dari data tiruan. Tahap backend: ganti isi fungsi ini
// dengan query database deterministik — bentuk `DashboardData` tetap sama.

import { connection } from "next/server";

import {
  MOCK_HARI_INI,
  MOCK_PERIODE,
  mockInvoices,
  mockOrganization,
  mockOwner,
  mockPayments,
  mockRooms,
  mockTenants,
} from "@/lib/mock/kos-melati";
import type {
  DashboardData,
  InvoiceRow,
  InvoiceStatus,
  PaymentRow,
  RekapTagihan,
  RoomTypeSummary,
} from "@/lib/types";

// Urutan tampil: yang perlu ditindak dulu, yang sudah beres belakangan.
const URUTAN_STATUS: Record<InvoiceStatus, number> = {
  jatuh_tempo: 0,
  perlu_review: 1,
  menunggu: 2,
  terkirim: 3,
  draft: 4,
  lunas: 5,
};

function urutkanInvoice(a: InvoiceRow, b: InvoiceRow) {
  const beda = URUTAN_STATUS[a.status] - URUTAN_STATUS[b.status];
  if (beda !== 0) return beda;
  if (a.status === "lunas") {
    return (b.dibayarPada ?? "").localeCompare(a.dibayarPada ?? "");
  }
  return a.jatuhTempo.localeCompare(b.jatuhTempo);
}

export async function getDashboardData(): Promise<DashboardData> {
  // Data dashboard selalu per-request (milik workspace yang sedang masuk), jangan di-prerender.
  await connection();

  const tenantById = new Map(mockTenants.map((t) => [t.id, t]));
  const roomById = new Map(mockRooms.map((r) => [r.id, r]));
  const penghuniByRoom = new Map(
    mockTenants.filter((t) => t.status === "aktif").map((t) => [t.roomId, t]),
  );

  const invoices: InvoiceRow[] = mockInvoices
    .filter((inv) => inv.periode === MOCK_PERIODE)
    .map((inv) => ({
      ...inv,
      namaPenghuni: tenantById.get(inv.tenantId)?.nama ?? "—",
      nomorKamar: roomById.get(inv.roomId)?.nomorKamar ?? "—",
    }))
    .sort(urutkanInvoice);

  const perTipe = new Map<string, RoomTypeSummary>();
  for (const room of mockRooms) {
    const ringkasan = perTipe.get(room.tipe) ?? {
      tipe: room.tipe,
      hargaSewa: room.hargaSewa,
      total: 0,
      terisi: 0,
    };
    ringkasan.total += 1;
    if (room.status === "terisi") ringkasan.terisi += 1;
    perTipe.set(room.tipe, ringkasan);
  }

  const kosong = mockRooms.filter((r) => r.status === "kosong");
  const rekap = (rows: InvoiceRow[]): RekapTagihan => ({
    jumlah: rows.length,
    nominal: rows.reduce((total, inv) => total + inv.nominal, 0),
  });
  const denganStatus = (status: InvoiceStatus) =>
    invoices.filter((inv) => inv.status === status);
  const lunas = rekap(denganStatus("lunas"));

  // Pemasukan dihitung dari pembayaran valid (hasil webhook), bukan dari status invoice.
  const invoiceById = new Map(invoices.map((inv) => [inv.id, inv]));
  const pembayaran: PaymentRow[] = mockPayments
    .filter((p) => p.status === "valid" && invoiceById.has(p.invoiceId))
    .map((p) => {
      const inv = invoiceById.get(p.invoiceId)!;
      return {
        id: p.id,
        invoiceId: p.invoiceId,
        nominalDibayar: p.nominalDibayar,
        metode: p.metode,
        diverifikasiPada: p.diverifikasiPada,
        namaPenghuni: inv.namaPenghuni,
        nomorKamar: inv.nomorKamar,
      };
    })
    .sort((a, b) => b.diverifikasiPada.localeCompare(a.diverifikasiPada));

  return {
    organization: mockOrganization,
    owner: mockOwner,
    hariIni: MOCK_HARI_INI,
    periode: MOCK_PERIODE,
    kamar: {
      total: mockRooms.length,
      terisi: mockRooms.length - kosong.length,
      kosong: kosong.length,
      perTipe: [...perTipe.values()],
      daftar: mockRooms
        .map((room) => ({
          id: room.id,
          nomorKamar: room.nomorKamar,
          tipe: room.tipe,
          hargaSewa: room.hargaSewa,
          status: room.status,
          namaPenghuni: penghuniByRoom.get(room.id)?.nama,
        }))
        .sort((a, b) => a.nomorKamar.localeCompare(b.nomorKamar)),
    },
    tagihan: {
      total: rekap(invoices),
      lunas,
      menunggu: rekap(denganStatus("menunggu")),
      jatuhTempo: rekap(denganStatus("jatuh_tempo")),
    },
    pemasukan: {
      bulanIni: pembayaran.reduce((total, p) => total + p.nominalDibayar, 0),
      jumlahPembayaran: pembayaran.length,
      terakhir: pembayaran.slice(0, 3),
    },
    invoices,
  };
}
