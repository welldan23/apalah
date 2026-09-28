# Kostera

Platform manajemen kos untuk owner/admin: dashboard, tagihan, dan pemantauan pembayaran
dalam satu tempat — dengan **Kosta AI**, asisten di WhatsApp.

Stack: Next.js (App Router) · Tailwind CSS v4 · shadcn/ui · PostgreSQL + Drizzle ORM.

## Menjalankan

```bash
npm install
npm run dev
```

`npm run dev` otomatis menjalankan migrasi database lalu mengisi data contoh Kos Melati.

Deploy produksi (kostera.id = landing, app.kostera.id = aplikasi): ikuti [docs/deploy-produksi.md](docs/deploy-produksi.md) dan jalankan
`npm run cek:produksi` dengan environment produksi sebelum deploy.

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

Untuk mengulang data contoh di database lokal, hapus folder `.data/` lalu jalankan `npm run dev`.

## Penjadwal (cron)

Dua endpoint dipanggil terjadwal dengan header `Authorization: Bearer <CRON_SECRET>`. Tanpa
`CRON_SECRET` di environment server, keduanya selalu menolak (401). Keduanya aman dipanggil
berulang atau bersamaan — tidak ada tagihan/pesan dobel.

| Endpoint | Kapan | Fungsi |
| --- | --- | --- |
| `/api/cron/harian` | sekali sehari, 00.05 WIB | Terbitkan tagihan terjadwal, lalu tandai tagihan yang lewat jatuh tempo |
| `/api/cron/pengingat` | tiap jam (menit ke-5) | Kirim pengingat bayar ke penyewa sesuai jadwal tiap kos |

Aturan pengingat otomatis: jadwal diatur per kos di **Reminder → Jadwal pengingat** (bawaan H-3, H, dan
H+3 pukul 09.00), hanya untuk tagihan yang belum dibayar, hanya dikirim pukul 06.00–21.00 WIB,
paling banyak sekali per penyewa per 24 jam, dan jadwal yang terlewat disusulkan paling lambat
24 jam kemudian.

- **Vercel:** sudah diatur di `vercel.json`. Paket Hobby hanya mengizinkan cron harian, jadi
  pengingat dijalankan sekali sehari pukul 09.05 WIB.
- **VPS:** tambahkan ke `crontab -e` (jam server UTC; 17.05 UTC = 00.05 WIB), ganti domain dan
  isi `CRON_SECRET` sama dengan environment aplikasi:

  ```cron
  CRON_SECRET=isi-dengan-rahasia-yang-sama
  5 17 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://domain-kamu/api/cron/harian > /dev/null
  5 * * * *  curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://domain-kamu/api/cron/pengingat > /dev/null
  ```

## Pembayaran online (Xendit)

Penyewa membayar dari link invoice lewat QRIS atau Virtual Account (BCA, BNI, BRI, Mandiri,
Permata). Uangnya masuk ke **sub-akun xenPlatform milik kos itu** (bukan ke akun Kostera), dan biaya
transaksi Xendit dipotong dari saldo sub-akun tersebut. Tanpa `XENDIT_SECRET_KEY`, halaman bayar
memakai **mode contoh** (nomor VA/QR tidak bisa dibayar). Untuk mengaktifkan:

1. Aktifkan xenPlatform di dashboard Xendit, lalu buat sub-akun untuk tiap kos (di mode test pun
   bisa). Sambungkan ID sub-akunnya ke kos lewat konsol `/platform` → detail workspace (wajib alasan,
   tercatat di log admin). Kos tanpa sub-akun tidak bisa membuat QRIS/VA.
2. Isi `XENDIT_SECRET_KEY` (secret key `xnd_development_…` dulu) dan `XENDIT_WEBHOOK_TOKEN` (Settings →
   Webhooks → *Webhook verification token*).
3. Di Settings → Webhooks, arahkan webhook **Payments** ke
   `https://domain-kamu/api/webhook/pembayaran/xendit`, dan atur webhook sub-akun ke akun master.

Status Lunas hanya berubah bila token webhook cocok **dan** status pembayarannya dibaca ulang dari
API Xendit; isi webhook tidak pernah dipercaya langsung. Notifikasi yang dikirim ulang tidak diproses
dua kali. Begitu Lunas, penyewa dapat bukti bayar dan owner/admin dapat kabar "Pembayaran masuk"
lewat WhatsApp.

## Template WhatsApp resmi (produksi)

Dengan `WHATSAPP_PROVIDER=meta`, pesan yang dimulai Kostera (ke penyewa, dan notifikasi ke owner)
wajib memakai template yang sudah disetujui. Isinya dibuat dari `src/lib/pesan.ts`; daftarkan
sekaligus lewat Graph API dengan `META_WA_TOKEN` + `META_WABA_ID` + `APP_URL`:

```bash
npm run meta:template            # lihat isi semua template
npm run meta:template -- daftar  # daftarkan ke WhatsApp Business Account
npm run meta:template -- cek     # status persetujuan (harus APPROVED semua)
```

| Template | Kategori | Dipakai untuk |
| --- | --- | --- |
| `kostera_tagihan_baru` | Utility | Link tagihan baru ke penyewa |
| `kostera_pengingat_sebelum` | Utility | Pengingat sebelum/tepat jatuh tempo |
| `kostera_pengingat_lewat` | Utility | Pengingat setelah lewat jatuh tempo |
| `kostera_pembayaran_diterima` | Utility | Konfirmasi pembayaran diterima (Lunas) |
| `kostera_tiket_diperbarui` | Utility | Kabar tiket keluhan sedang ditangani / selesai |
| `kostera_pembayaran_perlu_dicek` | Utility | Ke owner/admin: nominal pembayaran tidak cocok (Perlu review) |
| `kostera_kode_otp` | Authentication | Kode OTP daftar/masuk |

Template Utility punya satu tombol URL ke `https://domain-kamu/invoice/{{1}}` (untuk tiket, `{{1}}`
diisi `<token>/tiket/status`); `kostera_pembayaran_perlu_dicek` memakai tombol statis ke
`/pembayaran?status=perlu_review`. Balasan Kosta AI ke owner tidak butuh template karena selalu
dikirim dalam 24 jam setelah owner chat.

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
- `src/lib/data/` — kontrak data per halaman, dibaca dari database untuk kos yang sedang dibuka.
- `src/lib/mock/` — data contoh Kos Melati yang diisikan `npm run db:seed`.
