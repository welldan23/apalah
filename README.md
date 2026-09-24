# Kostera

Platform manajemen kos untuk owner/admin: dashboard, tagihan, dan pemantauan pembayaran
dalam satu tempat — dengan **Kosta**, asisten AI di WhatsApp.

Stack: Next.js (App Router) · Tailwind CSS v4 · shadcn/ui.

## Menjalankan

```bash
npm install
npm run dev
```

Buka http://localhost:3000 — otomatis diarahkan ke `/dashboard`.

## Struktur

- `src/app/(app)/` — halaman aplikasi owner (pakai app shell: sidebar desktop, bottom nav mobile).
- `src/components/app-shell/` — kerangka navigasi & identitas workspace.
- `src/components/dashboard/` — bagian-bagian Dashboard Kos.
- `src/lib/data/` — kontrak data per halaman. Saat ini membaca data tiruan
  (`src/lib/mock/`); lapisan backend nanti mengganti isinya dengan query database
  tanpa mengubah bentuk datanya.
