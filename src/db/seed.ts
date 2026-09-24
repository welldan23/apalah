// Isi data contoh Kos Melati (sama dengan data tiruan tahap frontend) ke database.
// Pakai: npm run db:seed. Aman diulang — dilewati bila Kos Melati sudah ada.

import { pathToFileURL } from "node:url";

import { eq } from "drizzle-orm";

import {
  mockInvoices,
  mockOrganization,
  mockOwner,
  mockPayments,
  mockRooms,
  mockTenants,
} from "../lib/mock/kos-melati.ts";
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
    await tx.insert(schema.tenants).values(mockTenants);
    await tx.insert(schema.invoices).values(
      mockInvoices.map((inv) => ({
        ...inv,
        diterbitkanPada: awalHariWib(inv.diterbitkanPada),
        dibayarPada: dibayarPada.get(inv.id) ?? null,
      })),
    );
    await tx.insert(schema.payments).values(
      mockPayments.map((p) => ({ ...p, diverifikasiPada: new Date(p.diverifikasiPada) })),
    );
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
