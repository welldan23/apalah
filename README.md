# Kostera

Platform manajemen kos untuk owner/admin: dashboard, tagihan, dan pemantauan pembayaran
dalam satu tempat — dengan **Kosta**, asisten AI di WhatsApp.

Stack: Next.js (App Router) · Tailwind CSS v4 · shadcn/ui · PostgreSQL + Drizzle ORM.

## Menjalankan

```bash
npm install
npm run dev
```

`npm run dev` otomatis menjalankan migrasi database lalu mengisi data contoh Kos Melati.

## Database

- **Lokal (default):** tanpa pengaturan apa pun, Kostera memakai PGlite — PostgreSQL yang
  berjalan di dalam proses Node — dengan data di folder `.data/` (tidak ikut git).
- **Supabase:** salin `.env.example` ke `.env.local`, isi `DATABASE_URL` dengan connection
  string *Transaction pooler* dari Supabase, lalu jalankan `npm run db:migrate`.

| Perintah | Fungsi |
| --- | --- |
| `npm run db:generate` | Buat file migrasi baru di `drizzle/` setelah `src/db/schema.ts` diubah |
| `npm run db:migrate` | Jalankan migrasi ke database aktif (aman diulang) |
| `npm run db:seed` | Isi data contoh Kos Melati bila belum ada |

Buka http://localhost:3000 — otomatis diarahkan ke `/dashboard`.

## Struktur

- `src/app/(app)/` — halaman aplikasi owner (pakai app shell: sidebar desktop, bottom nav mobile).
- `src/components/app-shell/` — kerangka navigasi & identitas workspace.
- `src/components/dashboard/` — bagian-bagian Dashboard Kos.
- `src/db/` — skema database (Drizzle), koneksi, migrasi, dan seed data contoh.
- `src/app/api/dashboard/` — endpoint dashboard: ringkasan, invoice, pemasukan, dan aksi cepat
  (buat tagihan, tambah penghuni, kirim reminder).
- `src/app/api/landing/konten` — konten landing publik (read-only, tanpa login).
- `src/lib/aksi/` — logika aksi yang mengubah data; nominal & status ditentukan server.
- `src/lib/whatsapp/` — adapter pengiriman WhatsApp (`WHATSAPP_PROVIDER`, default `log`).
- `src/lib/data/` — kontrak data per halaman. Saat ini membaca data tiruan
  (`src/lib/mock/`); lapisan backend nanti mengganti isinya dengan query database
  tanpa mengubah bentuk datanya.
