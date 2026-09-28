# Deploy produksi — kostera.id & app.kostera.id

Runbook deploy Kostera (repo ini). Satu deploy melayani dua domain:
`https://kostera.id` = landing, `https://app.kostera.id` = aplikasi (daftar, masuk, dashboard,
link invoice, webhook, cron). Di `kostera.id`, semua halaman selain landing & asetnya diteruskan ke
`app.kostera.id`; di `app.kostera.id`, `/` langsung ke dashboard (atau `/masuk` bila belum login).

Dua cara deploy: **VPS dengan Docker** (bagian 4a — aplikasi, PostgreSQL, HTTPS, jadwal, dan backup
dalam satu server) atau **Vercel + PostgreSQL terkelola** (bagian 4). Semua nilai rahasia diisi
lewat `deploy/vps/.env` di server (izin 600) atau Vercel → Settings → Environment Variables (tipe
*Sensitive*). Jangan menaruh nilainya di repo, chat, atau log.

## 0. Blocker yang harus beres dulu

- **Domain terdaftar di Hostinger, tetapi DNS-nya dikelola Cloudflare** (nameserver
  `hans`/`susan.ns.cloudflare.com`). Record diubah di Cloudflare, bukan di panel Hostinger.
- **Per 28 Sep 2026, `kostera.id`, `app.kostera.id`, dan `www` mengarah ke Cloudflare Tunnel yang
  sudah mati** (error 1033). Sebelumnya tunnel itu melayani landing lama dan `kostera-api` v0.2.0
  (`/health`, SPA di `/app/`). Bila server lama itu masih menyimpan data, backup dulu sebelum
  record-nya diganti. Link lama `app.kostera.id/app/…` otomatis diarahkan ke `/masuk`.
- Akses yang dibutuhkan: VPS (root/sudo) atau project Vercel, zona DNS `kostera.id` di Cloudflare,
  akun Xendit dengan xenPlatform aktif, dan WhatsApp Business (Meta) atau nomor khusus pilot WAHA.

## 1. Arsitektur

- **Aplikasi:** VPS (`Dockerfile` + `deploy/vps/`, bagian 4a) atau Vercel (`vercel.json` untuk
  cron). Build `npm run build`, tanpa database.
- **Database:** PostgreSQL persisten — di VPS berjalan sebagai container `db` (PostgreSQL 16, tidak
  dibuka ke internet); di Vercel pakai layanan terkelola (mis. Supabase, *Transaction pooler* port
  6543). Tanpa `DATABASE_URL`, aplikasi produksi **menolak jalan** (tidak memakai PGlite).
- **DNS:** di Cloudflare. VPS: record A `kostera.id`, `app`, dan `www` ke IP VPS. Vercel: `app`
  (CNAME) dan `kostera.id` (apex) ke target yang diberikan Vercel. Paling sederhana: *DNS only*
  (awan abu-abu) supaya sertifikat TLS diurus Caddy/Vercel. Kalau diproksikan Cloudflare, SSL mode
  wajib *Full (strict)*.
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
| `WHATSAPP_PROVIDER` | ya | `meta` — **bukan** `waha`/`log` (kecuali pilot WAHA, lihat bagian 6a) |
| `KOSTERA_MODE` | — | kosong = produksi penuh; `pilot` hanya untuk pilot WAHA internal |
| `META_WA_TOKEN`, `META_WA_PHONE_NUMBER_ID` | ya | System User token & Phone Number ID |
| `WHATSAPP_WEBHOOK_SECRET` | ya* | App Secret Meta (HMAC webhook masuk) |
| `WHATSAPP_VERIFY_TOKEN` | ya* | token verifikasi langganan webhook Meta |
| `XENDIT_SECRET_KEY` | nanti | mulai dari kunci **test** (`xnd_development_…`); `xnd_production_…` = uang sungguhan |
| `XENDIT_WEBHOOK_TOKEN` | nanti* | wajib begitu `XENDIT_SECRET_KEY` diisi — tanpa itu tagihan tidak pernah Lunas |
| `CRON_SECRET` | nanti | **kosongkan dulu** = semua cron menolak (401). Isi setelah WA & pembayaran terverifikasi |
| `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL` | tidak | tanpa kunci, Kosta AI memakai parser kata kunci |

\* tanpa ini Kosta AI lewat WhatsApp tidak aktif. Jangan isi `WAHA_*`, `WHATSAPP_NOMOR_UJI`, atau
`WAHA_IZINKAN_SEMUA_NOMOR` di produksi.

## 3. Sebelum deploy

1. **Backup.** Bila database produksi sudah berisi data:
   `pg_dump --format=custom --no-owner "$DATABASE_URL" > kostera-$(date +%F-%H%M).dump`
   (simpan di tempat aman, di luar repo). Database baru yang masih kosong tidak perlu dibackup.
2. **Cek konfigurasi** (hanya membaca, tidak mencetak nilai rahasia) dengan environment produksi:
   `npm run cek:produksi` → harus `✓ Tidak ada galat`. Peringatan (cron/Xendit belum diisi) boleh
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

## 4a. Deploy di VPS (Docker)

`deploy/vps/compose.yaml` menjalankan empat container: `app` (`next start`), `db` (PostgreSQL 16,
tidak dibuka ke internet), `caddy` (HTTPS otomatis Let's Encrypt di port 80/443), dan `jadwal`
(cron + backup harian ke `/var/backups/kostera`, disimpan 14 hari). Butuh Ubuntu/Debian, RAM + swap
±2 GB, disk kosong ≥ 6 GB, dan port 80/443 yang belum dipakai program lain. `pasang.sh` memeriksa
semua itu dulu dan berhenti tanpa mengubah apa pun bila ada yang belum cocok.

1. Masuk ke VPS (`ssh root@IP-VPS`), lalu ambil kodenya:
   `git clone https://github.com/welldan23/apalah.git /opt/kostera && cd /opt/kostera`
2. Periksa (tidak mengubah apa pun): `sudo bash deploy/vps/pasang.sh --cek` — menampilkan IP VPS.
3. DNS di Cloudflare → DNS → Records: hapus record `kostera.id`, `app`, dan `www` yang lama (yang
   ke tunnel; bila tidak bisa dihapus, hapus dulu *public hostname*-nya di Zero Trust → Networks →
   Tunnels), lalu buat record **A** untuk ketiganya ke IP VPS dengan *DNS only* (awan abu-abu).
4. Pasang: `sudo bash deploy/vps/pasang.sh`. Pertama kali skrip memasang Docker bila belum ada,
   membuat `deploy/vps/.env` (kata sandi database & `BETTER_AUTH_SECRET` diisi acak, tidak
   ditampilkan), build, migrasi, `cek:produksi`, lalu menyalakan semuanya. Sertifikat HTTPS dibuat
   otomatis begitu DNS mengarah ke VPS — tidak perlu pasang ulang.
5. Setelah admin platform masuk sekali lewat OTP:
   `docker compose -f deploy/vps/compose.yaml exec app npm run platform:admin -- tambah 62…`

- **Mengubah pengaturan** (WhatsApp, Xendit, `CRON_SECRET`): sunting `deploy/vps/.env` (contoh isi
  di `deploy/vps/env.contoh`), lalu jalankan lagi `sudo bash deploy/vps/pasang.sh`.
- **Memperbarui aplikasi:** `cd /opt/kostera && git pull && sudo bash deploy/vps/pasang.sh`. Database
  otomatis di-backup sebelum migrasi.
- **Jadwal otomatis** jalan begitu `CRON_SECRET` diisi: pekerjaan harian 00.05 WIB, pengingat dicek
  tiap jam. Backup 02.00 WIB selalu jalan. Log: `docker compose -f deploy/vps/compose.yaml logs jadwal`.
- **Backup** ada di `/var/backups/kostera/*.dump` (hanya root) — salin berkala ke luar VPS. Memulihkan:
  ```bash
  docker compose -f deploy/vps/compose.yaml stop app jadwal
  docker compose -f deploy/vps/compose.yaml exec -T db pg_restore --clean --no-owner -U kostera -d kostera < /var/backups/kostera/<berkas>.dump
  docker compose -f deploy/vps/compose.yaml start app jadwal
  ```
- Pilot WAHA (bagian 6a) bisa dijalankan di VPS yang sama; container-nya belum termasuk di
  `deploy/vps/`.

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
  -d '{}' https://app.kostera.id/api/webhook/pembayaran/xendit                       # 401
curl -sSI https://app.kostera.id/ | grep -i x-frame-options                         # DENY
```

Lalu uji manual: daftar/masuk dengan nomor WA sungguhan (OTP lewat template Meta), buat kos,
tagihan, buka link invoice dari ponsel lain.

## 6. Mengaktifkan cron, Xendit, dan Meta

- **Meta (WhatsApp first — ini jalur utama Kosta AI):**
  1. Di Meta for Developers: app tipe *Business* + produk WhatsApp, nomor bisnis, System User
     dengan izin `whatsapp_business_messaging` & `whatsapp_business_management` → token permanen
     (`META_WA_TOKEN`), plus Phone Number ID (`META_WA_PHONE_NUMBER_ID`), WhatsApp Business
     Account ID (`META_WABA_ID`), dan App Secret (`WHATSAPP_WEBHOOK_SECRET`).
  2. Template: `npm run meta:template -- daftar`, lalu `npm run meta:template -- cek` sampai
     semuanya `APPROVED`. Tanpa `kostera_kode_otp` yang disetujui, OTP (daftar/masuk) tidak terkirim.
  3. Webhook: Callback URL `https://app.kostera.id/api/webhook/whatsapp`, verify token =
     `WHATSAPP_VERIFY_TOKEN`, langganan field `messages`.
  4. Uji: chat nomor bisnis dari nomor owner yang sudah daftar → Kosta AI membalas.
- **Xendit (mode test dulu):**
  1. Dashboard Xendit → xenPlatform → *Activate xenPlatform* (pilih kasus "membantu merchant menerima
     pembayaran"). Uang penyewa masuk ke **sub-akun per kos**, bukan ke akun Kostera; biaya transaksi
     dipotong dari saldo sub-akun (ditanggung owner).
  2. Buat sub-akun untuk kos (verifikasi KYC oleh owner lewat undangan Xendit di mode live), atur
     webhook sub-akun ke akun master, lalu sambungkan ID sub-akunnya di `/platform` → detail workspace.
  3. Settings → Webhooks: URL **Payments** `https://app.kostera.id/api/webhook/pembayaran/xendit`;
     salin *Webhook verification token* ke `XENDIT_WEBHOOK_TOKEN`.
  4. Uji di mode test: buka link invoice → pilih VA/QRIS → simulasikan pembayaran dari dashboard Xendit
     (atau `POST /v3/payment_requests/{id}/simulate`) → tagihan Lunas, penyewa & owner dapat WA.
  5. Pindah ke uang sungguhan: ganti ke `xnd_production_…` + token webhook mode live, jalankan lagi
     `npm run cek:produksi`, perbarui URL webhook di dashboard live.
  Status Lunas hanya bila token webhook cocok, transaksinya dibuat Kostera, dan status + nominalnya
  dibaca ulang dari API Xendit atas nama sub-akun kos.
- **Cron:** setelah WA & pembayaran terverifikasi, isi `CRON_SECRET` lalu redeploy (VPS: isi di
  `deploy/vps/.env`, jalankan lagi `pasang.sh`; container `jadwal` yang memanggil). Vercel Cron
  mengirim header `Authorization: Bearer <CRON_SECRET>` otomatis (jadwal di `vercel.json`).

## 6a. Pilot WAHA (sementara, khusus owner)

Selama akun Meta & template belum siap, Kosta AI bisa dipilot lewat WAHA (WhatsApp HTTP API,
self-hosted, **tidak resmi**). Aturannya ketat supaya tidak ada pesan nyasar ke penyewa sungguhan:

- **Hanya nomor di `WHATSAPP_NOMOR_UJI` yang dikirimi** — termasuk OTP, jadi hanya owner pilot yang
  bisa daftar/masuk. Tagihan & pengingat ke penyewa **ditahan** (tercatat gagal "di luar daftar uji").
- **Pakai nomor WhatsApp khusus pilot**, bukan nomor pribadi/utama: nomor yang dipakai WAHA berisiko
  diblokir WhatsApp.
- **Server WAHA** (Docker di VPS) wajib di belakang HTTPS dan memakai API key; jangan buka port WAHA
  langsung ke internet tanpa keduanya. Scan QR sekali dari HP nomor pilot.
- **Webhook di WAHA:** URL `https://app.kostera.id/api/webhook/whatsapp`, event `message`, HMAC key =
  `WHATSAPP_WEBHOOK_SECRET` (SHA-512). Tanpa HMAC yang cocok, pesan ditolak (401).
- **Environment (Vercel):** `KOSTERA_MODE=pilot`, `WHATSAPP_PROVIDER=waha`, `WAHA_URL=https://…`,
  `WAHA_API_KEY`, `WAHA_SESSION` (bawaan `default`), `WHATSAPP_NOMOR_UJI=628…,628…` (nomor owner
  pilot), `WHATSAPP_WEBHOOK_SECRET`. **Jangan** isi `WAHA_IZINKAN_SEMUA_NOMOR`.
- `npm run cek:produksi` dengan env di atas harus `✓ Tidak ada galat` (satu peringatan "Mode pilot").

**Pindah ke produksi (Meta):** daftarkan template (`npm run meta:template -- daftar` sampai semuanya
`APPROVED`), ganti `WHATSAPP_PROVIDER=meta` + variabel `META_*` + `WHATSAPP_VERIFY_TOKEN`, hapus
`KOSTERA_MODE`, `WAHA_*`, dan `WHATSAPP_NOMOR_UJI`, jalankan `cek:produksi`, lalu deploy ulang.

## 7. Operasional

Di VPS, `dc` = `docker compose -f deploy/vps/compose.yaml` (jalankan dari `/opt/kostera`).

| Kebutuhan | VPS (Docker) | Vercel |
| --- | --- | --- |
| Status | `dc ps` | Dashboard → Deployments, atau `vercel ls` |
| Log (tanpa isi pesan/OTP) | `dc logs -f app` (atau `caddy`, `jadwal`) | Dashboard → Logs, atau `vercel logs <url-deployment>` |
| Restart | `dc restart app` | *Redeploy* deployment terakhir |
| Rollback aplikasi | `git checkout <commit-lama> && sudo bash deploy/vps/pasang.sh` | *Instant Rollback*, atau `vercel rollback` |
| Rollback database | `drizzle/rollback/*.down.sql` (terbaru dulu, lihat README di folder itu) atau pulihkan dump (VPS: bagian 4a; Vercel: `pg_restore --clean --no-owner -d "$DATABASE_URL" <file.dump>`) | sama |
