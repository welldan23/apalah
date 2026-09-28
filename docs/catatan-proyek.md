# Catatan proyek Kostera

Ingatan proyek untuk setiap sesi Claude/agent: aturan, keputusan, dan status terakhir. Dimuat otomatis
lewat `CLAUDE.md`. Perbarui bagian **Status** setiap kali ada pekerjaan besar yang selesai atau
keputusan baru. Jangan pernah menulis rahasia (token, kunci, kata sandi, connection string) di sini.

## Apa ini

- **Kostera**: aplikasi manajemen kos untuk owner — kamar, penghuni, tagihan, pembayaran, tiket.
- **Kosta AI**: asisten owner di WhatsApp (juga ada chat web di dashboard). Hanya membaca data dan
  menyiapkan aksi; aksi baru jalan setelah owner membalas kode konfirmasi.
- Domain: `kostera.id` = landing, `app.kostera.id` = aplikasi. Repo: `welldan23/apalah`.

## Cara berkomunikasi dengan pemilik

- Bahasa Indonesia santai dan sederhana, seperti teman ngobrol. Istilah teknis langsung dijelaskan
  dengan bahasa sehari-hari atau contoh.
- Pemilik bukan programmer: beri langkah copy-paste yang jelas, jelaskan apa efeknya.

## Aturan keras (jangan dilanggar)

- Jangan ubah scope, jangan rewrite besar, jangan hapus data atau project lain.
- Jangan baca, cetak, atau commit rahasia (`.env*`, token, API key, connection string). Semua URL,
  token, dan secret lewat environment variable — tidak di-hardcode, tidak di-log.
- Jangan deploy atau ubah DNS kalau akses/credential belum ada: berhenti dan laporkan blocker-nya.
- AI hanya parser/perencana aksi. Nominal tagihan, status pembayaran, dan uang dihitung di server
  secara deterministik.
- Status **Lunas hanya dari webhook payment gateway yang tervalidasi** (Xendit: token webhook cocok,
  transaksi buatan Kostera, status + nominal dibaca ulang dari API Xendit). Screenshot transfer,
  pesan, OCR, atau klaim penyewa hanyalah klaim — Kosta tidak boleh menandai lunas dari situ.
- Owner tidak perlu mencatat pembayaran manual: uang masuk → Lunas → WA ke penyewa & owner otomatis.
- WAHA hanya untuk sandbox/pilot internal (nomor uji saja). Pesan ke penyewa di produksi wajib Meta
  WhatsApp Cloud API.
- Jangan kirim blast/pesan ke penyewa sungguhan selama development/test.
- Payment, reminder, dan cron tidak boleh bisa jalan dobel (idempoten).
- Platform admin tidak boleh mengubah invoice, pembayaran, atau data penyewa owner diam-diam
  (wajib alasan + tercatat di audit log).
- Git: kerja di branch, masuk ke `main` lewat PR. Jangan force-push atau menulis ulang riwayat.

## Keputusan yang sudah diambil

- **Pembayaran: Xendit** (Payments API v3 + xenPlatform). Midtrans dan pencatatan transfer manual
  sudah dibuang. Uang penyewa masuk ke **sub-akun xenPlatform per kos**; **biaya transaksi ditanggung
  owner**; **payout ke rekening owner sekali sehari** (Tahap B). Metode: QRIS + VA BCA/BNI/BRI/
  Mandiri/Permata, dengan batas nominal per metode (`src/lib/pembayaran/metode.ts`).
- **WhatsApp**: Meta Cloud API untuk produksi. Template harus `APPROVED` dulu
  (`npm run meta:template -- daftar` / `-- cek`): `kostera_kode_otp`, `kostera_tagihan_baru`,
  `kostera_pengingat_sebelum`, `kostera_pengingat_lewat`, `kostera_pembayaran_diterima`,
  `kostera_pembayaran_masuk`, `kostera_pembayaran_perlu_dicek`, `kostera_tiket_diperbarui`.
  Pilot WAHA: `KOSTERA_MODE=pilot` + `WHATSAPP_NOMOR_UJI`.
- **Deploy: VPS milik owner dengan Docker** — `deploy/vps/pasang.sh` (tidak harus root), panduan di
  `docs/deploy-produksi.md` bagian 4a. Vercel tetap terdokumentasi sebagai alternatif.
- **DNS**: domain `kostera.id` terdaftar di Hostinger, tetapi DNS-nya dikelola **Cloudflare**. Per
  28 Sep 2026 record lama masih mengarah ke Cloudflare Tunnel yang sudah mati (error 1033).
- **Desain**: gaya nota & buku kas — IBM Plex Sans/Mono, palet kertas & tinta (OKLCH), radius kecil,
  badge status seperti cap. Landing berstruktur "satu bulan di kos" (Narrative Workflow) hasil audit
  **Hallmark**; pakai skill `hallmark` untuk setiap UI baru. Warna hanya lewat token di
  `src/app/globals.css` (tanpa hex inline); warna WhatsApp lewat token `--wa-*`.
- Nama variabel, fungsi, dan teks di kode memakai Bahasa Indonesia — ikuti gaya yang ada.

## Teknis singkat

- Next.js 16 App Router (baca `node_modules/next/dist/docs/` dulu — lihat `AGENTS.md`), Tailwind v4,
  komponen shadcn, Drizzle + PostgreSQL (tanpa `DATABASE_URL` di lokal memakai PGlite di `.data/`),
  Better Auth (login nomor WA + OTP), test runner bawaan Node.
- Cek sebelum commit: `npm test`, `npx tsc --noEmit`, `npx eslint`, `npm run build`.
- Migrasi: `npm run db:generate` → file di `drizzle/`, plus file rollback di `drizzle/rollback/`.
  `npm run db:seed` ditolak di produksi. `npm run cek:produksi` memeriksa konfigurasi tanpa
  menampilkan rahasia.
- `APP_URL` & `LANDING_URL` dibaca saat **build** (pembagian domain) — ubah nilainya = build ulang.
- Webhook Xendit: status selalu dibaca ulang dari API Xendit atas nama sub-akun
  (`payment_attempts.akun_gateway`) sebelum `prosesNotifikasiPembayaran`.

## Status (per 28 Sep 2026)

**Sudah selesai dan ada di `main`** (PR welldan23/apalah#1–#3):
aplikasi inti (akun, kos, kamar, penghuni, tagihan, invoice publik, tiket), Kosta AI dengan
konfirmasi kode, konsol platform admin, pembayaran Xendit Tahap A + kabar "pembayaran masuk" ke
owner, pengaman produksi, tampilan baru + audit Hallmark, paket deploy VPS.

**Berikutnya:**
1. Deploy ke VPS: owner menjalankan `bash deploy/vps/pasang.sh --cek`, mengganti DNS di Cloudflare
   ke IP VPS (DNS only), lalu `bash deploy/vps/pasang.sh`.
2. WhatsApp: pilih Meta (resmi) atau pilot WAHA. Container WAHA belum ada di `deploy/vps/`.
3. Xendit **Tahap B** (menunggu test key + xenPlatform aktif dari owner): buat sub-akun otomatis +
   undangan KYC, payout harian ke rekening owner, WA "dana sudah masuk rekening". Rute penerima
   payout di API `/v3/payouts` belum jelas — cek ulang dokumentasi Xendit saat mengerjakan.
4. Isi `CRON_SECRET` setelah WhatsApp & pembayaran terverifikasi (tagihan & pengingat otomatis).
5. Tambah admin platform setelah login pertama: `npm run platform:admin -- tambah 62…`.

**Masih dibutuhkan dari owner:** akun Xendit + key test/live dan xenPlatform aktif, WhatsApp
Business (Meta) + persetujuan template atau nomor khusus pilot WAHA, akses Cloudflare untuk DNS.
