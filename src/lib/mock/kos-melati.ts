// Data tiruan (stub) untuk tahap frontend: satu kos contoh, "Kos Melati".
// Angkanya sengaja disusun agar cocok dengan contoh di PRD:
// 40 kamar, 34 terisi, 3 tagihan jatuh tempo, Rp12,5jt masuk bulan ini — plus satu
// pembayaran yang nominalnya tidak cocok (C09) untuk contoh status Perlu Review.
// Akan diganti query database saat lapisan backend dibangun.

import type {
  Invoice,
  InvoiceStatus,
  Organization,
  Owner,
  Payment,
  Room,
  Tenant,
} from "@/lib/types";

export const MOCK_HARI_INI = "2026-09-24";
export const MOCK_PERIODE = "2026-09";

export const mockOrganization: Organization = {
  id: "org_kos_melati",
  namaKos: "Kos Melati",
  alamat: "Jl. Melati No. 12, Condongcatur, Sleman",
  jumlahKamar: 40,
};

export const mockOwner: Owner = {
  id: "usr_ratna",
  nama: "Ratna Wijayanti",
  nomorWa: "6281234567890",
};

const TIPE_KAMAR = [
  { prefix: "A", tipe: "Standar", hargaSewa: 500_000, jumlah: 12 },
  { prefix: "B", tipe: "KM Dalam", hargaSewa: 650_000, jumlah: 16 },
  { prefix: "C", tipe: "AC", hargaSewa: 800_000, jumlah: 12 },
] as const;

// [nomor kamar, nama penghuni, tanggal masuk, status invoice periode ini, tanggal bayar]
type TenantSeed = [string, string, string, InvoiceStatus, string?];

const PENGHUNI: TenantSeed[] = [
  ["A01", "Dimas Pratama", "2025-02-03", "lunas", "2026-09-02"],
  ["A02", "Siti Rahmawati", "2024-08-05", "lunas", "2026-09-05"],
  ["A03", "Yoga Saputra", "2025-07-26", "menunggu"],
  ["A04", "Nabila Putri", "2025-01-10", "lunas", "2026-09-09"],
  ["A05", "Rizky Ramadhan", "2024-11-15", "jatuh_tempo"],
  ["A06", "Anisa Fitriani", "2026-03-25", "menunggu"],
  ["A08", "Bagus Wicaksono", "2025-09-28", "menunggu"],
  ["A09", "Dewi Anggraini", "2025-04-12", "lunas", "2026-09-11"],
  ["A10", "Fajar Nugroho", "2026-06-27", "menunggu"],
  ["A12", "Intan Permatasari", "2025-10-30", "menunggu"],
  ["B01", "Muhammad Alif", "2024-09-01", "lunas", "2026-09-01"],
  ["B02", "Putri Ayu Lestari", "2025-03-04", "lunas", "2026-09-03"],
  ["B03", "Hendra Gunawan", "2025-05-06", "lunas", "2026-09-06"],
  ["B04", "Ayu Wulandari", "2024-12-08", "lunas", "2026-09-07"],
  ["B06", "Reza Kurniawan", "2025-08-18", "jatuh_tempo"],
  ["B07", "Salsabila Azzahra", "2025-02-10", "lunas", "2026-09-10"],
  ["B08", "Galih Permana", "2026-01-12", "lunas", "2026-09-12"],
  ["B09", "Maya Sari", "2025-06-14", "lunas", "2026-09-13"],
  ["B10", "Arif Hidayat", "2025-11-16", "lunas", "2026-09-16"],
  ["B11", "Rina Marlina", "2024-10-19", "lunas", "2026-09-18"],
  ["B12", "Kevin Wijaya", "2026-02-20", "lunas", "2026-09-20"],
  ["B14", "Lia Kusumawati", "2025-12-26", "menunggu"],
  ["B15", "Andi Firmansyah", "2026-04-24", "menunggu"],
  ["B16", "Tiara Ramadhani", "2025-07-29", "menunggu"],
  ["C01", "Yohanes Christian", "2025-01-02", "lunas", "2026-09-01"],
  ["C02", "Clara Anindita", "2025-06-05", "lunas", "2026-09-04"],
  ["C04", "Farhan Maulana", "2024-07-09", "lunas", "2026-09-08"],
  ["C05", "Nadia Safitri", "2025-09-20", "jatuh_tempo"],
  ["C06", "Wayan Aditya", "2026-05-11", "lunas", "2026-09-10"],
  ["C07", "Kadek Sri Wahyuni", "2025-10-14", "lunas", "2026-09-14"],
  ["C08", "Ilham Syahputra", "2026-07-25", "menunggu"],
  ["C09", "Grace Natalia", "2025-03-27", "perlu_review"],
  ["C11", "Bima Aryasatya", "2025-11-28", "menunggu"],
  ["C12", "Aulia Rahmah", "2026-08-30", "menunggu"],
];

const kamarTerisi = new Set(PENGHUNI.map(([nomorKamar]) => nomorKamar));

export const mockRooms: Room[] = TIPE_KAMAR.flatMap(
  ({ prefix, tipe, hargaSewa, jumlah }) =>
    Array.from({ length: jumlah }, (_, i) => {
      const nomorKamar = `${prefix}${String(i + 1).padStart(2, "0")}`;
      return {
        id: `room_${nomorKamar}`,
        organizationId: mockOrganization.id,
        nomorKamar,
        tipe,
        hargaSewa,
        status: kamarTerisi.has(nomorKamar) ? "terisi" : "kosong",
      } satisfies Room;
    }),
);

const roomByNomor = new Map(mockRooms.map((room) => [room.nomorKamar, room]));

export const mockTenants: Tenant[] = PENGHUNI.map(
  ([nomorKamar, nama, tanggalMasuk], i) => {
    const room = roomByNomor.get(nomorKamar)!;
    return {
      id: `tnt_${nomorKamar}`,
      organizationId: mockOrganization.id,
      nama,
      nomorWa: `62813${String(20_450_000 + i * 7_919).padStart(8, "0")}`,
      roomId: room.id,
      tanggalMasuk,
      status: "aktif",
      hargaSewa: room.hargaSewa,
    };
  },
);

/** Mantan penghuni (status keluar) — kamarnya kini kosong. */
export const mockPenghuniKeluar: Tenant[] = [
  {
    id: "tnt_keluar_A07",
    organizationId: mockOrganization.id,
    nama: "Rudi Hartono",
    nomorWa: "6281377001122",
    roomId: "room_A07",
    tanggalMasuk: "2024-03-01",
    tanggalKeluar: "2026-06-30",
    status: "keluar",
    hargaSewa: 500_000,
  },
  {
    id: "tnt_keluar_B05",
    organizationId: mockOrganization.id,
    nama: "Mega Lestari",
    nomorWa: "6281377003344",
    roomId: "room_B05",
    tanggalMasuk: "2025-01-10",
    tanggalKeluar: "2026-08-31",
    status: "keluar",
    hargaSewa: 650_000,
  },
];

/** Jatuh tempo bulanan mengikuti tanggal masuk penghuni. */
function jatuhTempoPeriodeIni(tanggalMasuk: string) {
  const hari = tanggalMasuk.slice(8, 10);
  return `${MOCK_PERIODE}-${hari}`;
}

function kurangiHari(isoDate: string, hari: number) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - hari);
  return d.toISOString().slice(0, 10);
}

export const mockInvoices: Invoice[] = PENGHUNI.map(
  ([nomorKamar, , tanggalMasuk, status, dibayarPada], i) => {
    const tenant = mockTenants[i];
    const jatuhTempo = jatuhTempoPeriodeIni(tanggalMasuk);
    return {
      id: `inv_${MOCK_PERIODE}_${nomorKamar}`,
      organizationId: mockOrganization.id,
      tenantId: tenant.id,
      roomId: tenant.roomId,
      periode: MOCK_PERIODE,
      nominal: tenant.hargaSewa,
      jatuhTempo,
      status,
      tokenPublik: `demo-${nomorKamar.toLowerCase()}-${MOCK_PERIODE}`,
      diterbitkanPada: kurangiHari(jatuhTempo, 7),
      dibayarPada,
    };
  },
);

const METODE_BAYAR = ["QRIS", "VA BCA", "VA Mandiri", "QRIS", "VA BRI"] as const;

// Pembayaran tercatat dari webhook gateway (status valid) untuk invoice yang lunas.
const pembayaranLunas: Payment[] = mockInvoices
  .filter((inv) => inv.status === "lunas" && inv.dibayarPada)
  .map((inv, i) => {
    const jam = String(8 + ((i * 5) % 13)).padStart(2, "0");
    const menit = String((i * 17) % 60).padStart(2, "0");
    return {
      id: `pay_${inv.id}`,
      invoiceId: inv.id,
      nominalDibayar: inv.nominal,
      metode: METODE_BAYAR[i % METODE_BAYAR.length],
      provider: "midtrans",
      referensiProvider: `demo-ref-${inv.id}`,
      status: "valid",
      diverifikasiPada: `${inv.dibayarPada}T${jam}:${menit}:00+07:00`,
    };
  });

// Nominal tidak cocok: Grace (C09) membayar Rp750.000 untuk tagihan Rp800.000 → invoice Perlu Review.
const pembayaranTidakCocok: Payment = {
  id: `pay_inv_${MOCK_PERIODE}_C09`,
  invoiceId: `inv_${MOCK_PERIODE}_C09`,
  nominalDibayar: 750_000,
  metode: "QRIS",
  provider: "midtrans",
  referensiProvider: `demo-ref-inv_${MOCK_PERIODE}_C09`,
  status: "tidak_cocok",
  diverifikasiPada: `${MOCK_PERIODE}-23T19:42:00+07:00`,
};

export const mockPayments: Payment[] = [...pembayaranLunas, pembayaranTidakCocok];
