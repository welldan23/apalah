# Deploy produksi — kostera.id & app.kostera.id

Runbook deploy Kostera (repo ini). Satu project Vercel melayani dua domain:
`https://kostera.id` = landing, `https://app.kostera.id` = aplikasi (daftar, masuk, dashboard,
link invoice, webhook, cron). Di `kostera.id`, semua halaman selain landing & asetnya diteruskan ke
`app.kostera.id`; di `app.kostera.id`, `/` langsung ke dashboard (atau `/masuk` bila belum login).
Semua nilai rahasia diisi lewat secret manager (Vercel → Project → Settings → Environment
Variables, tipe *Sensitive*). Jangan menaruh nilainya di repo, chat, atau log.

## 0. Blocker yang harus beres dulu

- **`app.kostera.id` sekarang melayani aplikasi lain** (`kostera-api` v0.2.0: `/health`, SPA di
  `/app/`). Mengarahkan domain ke deploy ini menggantikan layanan itu. Pemiliknya harus memutuskan
  dulu nasib layanan itu dan membackup datanya. Link lama `app.kostera.id/app/…` otomatis diarahkan
  ke `/masuk`.
- **`kostera.id` sekarang menampilkan landing lama** (statis). Memindahkan DNS-nya ke Vercel
  menggantinya dengan landing baru dari repo ini.
- Akses yang dibutuhkan: project Vercel (atau token deploy), zona DNS `kostera.id` di Cloudflare,
  database PostgreSQL produksi, akun Midtrans, dan WhatsApp Business (Meta).

## 1. Arsitektur

- **Aplikasi:** Vercel (sudah ada `vercel.json` untuk cron). Build `npm run build`, tanpa database.
- **Database:** PostgreSQL persisten (mis. Supabase, connection string *Transaction pooler* port 6543).
  Tanpa `DATABASE_URL`, aplikasi produksi **menolak jalan** (tidak memakai PGlite).
- **DNS:** di Cloudflare, `app` (CNAME) dan `kostera.id` (apex: A record / CNAME flattening) ke
  target yang diberikan Vercel. Paling sederhana: *DNS only* (awan abu-abu) supaya sertifikat TLS
  diurus Vercel. Kalau diproksikan Cloudflare, SSL mode wajib *Full (strict)*.
- **Pembagian domain** diatur aplikasi lewat `APP_URL` + `LANDING_URL` (dibaca saat build — ubah
  nilainya = deploy ulang). Di Vercel → Domains, **jangan** pasang opsi "Redirect to" antar kedua
  domain; biarkan keduanya melayani deploy yang sama.

## 2. Environment produksi (nama saja — nilainya di secret manager)

| Variabel | Wajib | Catatan |
| --- | --- | --- |
| `DATABASE_URL` | ya | PostgreSQL produksi |
| `APP_URL` | ya | `https://app.kostera.id` |
| `LANDING_URL` | ya | `https://kostera.id` — kosongkan bila semua masih di satu domain (mis. `*.vercel.app`) |
| `BETTER_AUTH_SECRET` | ya | acak ≥ 32 karakter (`openssl rand -base64 32`) |
| `BETTER_AUTH_URL` | tidak | kosongkan, atau sama persis dengan `APP_URL` |
| `WHATSAPP_PROVIDER` | ya | `meta` — **bukan** `waha`/`log` |
| `META_WA_TOKEN`, `META_WA_PHONE_NUMBER_ID` | ya | System User token & Phone Number ID |
| `WHATSAPP_WEBHOOK_SECRET` | ya* | App Secret Meta (HMAC webhook masuk) |
| `WHATSAPP_VERIFY_TOKEN` | ya* | token verifikasi langganan webhook Meta |
| `MIDTRANS_SERVER_KEY` | nanti | mulai dari **sandbox** (`SB-Mid-server-…`) |
| `MIDTRANS_PRODUCTION` | — | biarkan kosong/`false` sampai server key produksi & Notification URL siap |
| `CRON_SECRET` | nanti | **kosongkan dulu** = semua cron menolak (401). Isi setelah WA & pembayaran terverifikasi |
| `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL` | tidak | tanpa kunci, Kosta AI memakai parser kata kunci |

\* tanpa ini Kosta AI lewat WhatsApp tidak aktif. Jangan isi `WAHA_*`, `WHATSAPP_NOMOR_UJI`, atau
`WAHA_IZINKAN_SEMUA_NOMOR` di produksi.

## 3. Sebelum deploy

1. **Backup.** Bila database produksi sudah berisi data:
   `pg_dump --format=custom --no-owner "$DATABASE_URL" > kostera-$(date +%F-%H%M).dump`
   (simpan di tempat aman, di luar repo). Database baru yang masih kosong tidak perlu dibackup.
2. **Cek konfigurasi** (hanya membaca, tidak mencetak nilai rahasia) dengan environment produksi:
   `npm run cek:produksi` → harus `✓ Tidak ada galat`. Peringatan (cron/Midtrans belum diisi) boleh
   ada selama memang disengaja.
3. **Migrasi terkendali** dari mesin tepercaya: `npm run db:migrate` (aman diulang). **Jangan pernah**
   menjalankan `npm run db:seed` ke database produksi (skrip menolak bila `NODE_ENV=production`).

## 4. Deploy & domain

1. Hubungkan repo ke project Vercel, isi environment *Production* (bagian 2), deploy dari branch
   yang sudah lulus test.
2. Uji dulu di alamat `*.vercel.app` (tanpa `LANDING_URL`). Setelah lolos, isi `LANDING_URL`,
   tambahkan domain `app.kostera.id` dan `kostera.id` di Vercel, deploy ulang, lalu ubah DNS di
   Cloudflare sesuai instruksi Vercel.
3. Setelah admin platform masuk sekali lewat OTP: `npm run platform:admin -- tambah 62…`.

## 5. Verifikasi setelah deploy (dari luar server)

```bash
curl -sSI https://kostera.id/ | head -1                          # 200 landing, sertifikat valid
curl -sS -o /dev/null -w "%{http_code} %{redirect_url}\n" https://kostera.id/daftar # 307 → https://app.kostera.id/daftar
curl -sS -o /dev/null -w "%{http_code} %{redirect_url}\n" https://app.kostera.id/   # 307 → /dashboard
curl -sS -o /dev/null -w "%{http_code}\n" https://app.kostera.id/dashboard          # 307 → /masuk
curl -sS -o /dev/null -w "%{http_code}\n" https://app.kostera.id/masuk              # 200
curl -sS -o /dev/null -w "%{http_code}\n" https://app.kostera.id/api/dashboard/ringkasan  # 401
curl -sS -o /dev/null -w "%{http_code}\n" https://app.kostera.id/api/cron/harian    # 401
curl -sS -o /dev/null -w "%{http_code}\n" -X POST -H 'content-type: application/json' \
  -d '{}' https://app.kostera.id/api/webhook/pembayaran/midtrans                     # 401
curl -sSI https://app.kostera.id/ | grep -i x-frame-options                         # DENY
```

Lalu uji manual: daftar/masuk dengan nomor WA sungguhan (OTP lewat template Meta), buat kos,
tagihan, buka link invoice dari ponsel lain.

## 6. Mengaktifkan cron, Midtrans, dan Meta

- **Meta:** daftarkan template di README (bagian *Template WhatsApp resmi*), set Callback URL
  `https://app.kostera.id/api/webhook/whatsapp` + verify token.
- **Midtrans (sandbox dulu):** Notification URL `https://app.kostera.id/api/webhook/pembayaran/midtrans`.
  Status Lunas hanya dari notifikasi bertanda tangan dengan `status_code` 200 dan nominal cocok.
  Pindah ke produksi: ganti server key produksi + `MIDTRANS_PRODUCTION=true`, jalankan lagi
  `npm run cek:produksi`, perbarui Notification URL di dashboard produksi.
- **Cron:** setelah WA & pembayaran terverifikasi, isi `CRON_SECRET` lalu redeploy. Vercel Cron
  mengirim header `Authorization: Bearer <CRON_SECRET>` otomatis (jadwal di `vercel.json`).

## 7. Operasional

| Kebutuhan | Vercel |
| --- | --- |
| Status | Dashboard → Deployments, atau `vercel ls` |
| Log (tanpa isi pesan/OTP) | Dashboard → Logs, atau `vercel logs <url-deployment>` |
| Restart | *Redeploy* deployment terakhir (tidak ada proses yang perlu di-restart) |
| Rollback aplikasi | *Instant Rollback* ke deployment sebelumnya, atau `vercel rollback` |
| Rollback database | `drizzle/rollback/*.down.sql` (terbaru dulu, lihat README di folder itu) atau pulihkan dump: `pg_restore --clean --no-owner -d "$DATABASE_URL" <file.dump>` |

Bila suatu saat memakai VPS: `npm ci && npm run build && npm run start` di belakang reverse proxy
HTTPS (jangan membuka port Node langsung), dengan environment yang sama dan cron lewat crontab
seperti di README.
