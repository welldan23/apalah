#!/usr/bin/env bash
# Pasang atau perbarui Kostera di VPS (Ubuntu/Debian) memakai Docker.
#
#   bash deploy/vps/pasang.sh --cek   # hanya memeriksa VPS & DNS, tidak mengubah apa pun
#   bash deploy/vps/pasang.sh         # pasang pertama kali, atau perbarui setelah `git pull`
#
# Tidak harus root: user biasa cukup sudah boleh memakai Docker (grup docker). Root/sudo hanya
# perlu kalau Docker belum terpasang — skrip memasangnya sendiri bila dijalankan sebagai root.
# Aman diulang. Tidak pernah menampilkan isi rahasia. Tidak menyentuh container/program lain:
# kalau port 80/443 sudah dipakai program lain, skrip berhenti sebelum mengubah apa pun.
# Database di-backup dulu sebelum migrasi setiap kali memperbarui.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$DIR/.env"
PROJECT=kostera-vps
CEK_SAJA=false
[[ "${1:-}" == "--cek" ]] && CEK_SAJA=true

ada_masalah=false
ok() { echo "  ✓ $*"; }
catatan() { echo "  ! $*"; }
masalah() { echo "  ✗ $*"; ada_masalah=true; }
compose() { docker compose -f "$DIR/compose.yaml" "$@"; }
# Nilai satu variabel dari .env (atau env.contoh sebelum .env ada) — hanya untuk nilai non-rahasia.
nilai() { grep -E "^$1=" "${2:-$ENV_FILE}" 2>/dev/null | tail -1 | cut -d= -f2- || true; }

echo "== Memeriksa VPS =="
root=false
if [[ $EUID -eq 0 ]]; then root=true; ok "Jalan sebagai root"; else ok "Jalan sebagai user $(id -un) (tanpa root)"; fi

# shellcheck disable=SC1091
. /etc/os-release
case "${ID:-}" in
  ubuntu | debian) ok "Sistem: ${PRETTY_NAME:-$ID}" ;;
  *) catatan "Sistem ${PRETTY_NAME:-tidak dikenal} belum pernah diuji (disarankan Ubuntu 22.04/24.04)." ;;
esac

ram=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
swap=$(awk '/SwapTotal/ {print int($2/1024)}' /proc/meminfo)
if ((ram + swap < 1900)); then
  masalah "RAM ${ram} MB + swap ${swap} MB kurang untuk build aplikasi (butuh ±2 GB). Tambah swap dulu."
else
  ok "RAM ${ram} MB, swap ${swap} MB"
fi

disk=$(df -Pm / | awk 'NR==2 {print $4}')
if ((disk < 6000)); then masalah "Sisa disk ${disk} MB, butuh minimal 6 GB."; else ok "Sisa disk ${disk} MB"; fi

punya_docker=false
if command -v docker >/dev/null && docker compose version >/dev/null 2>&1; then
  if docker info >/dev/null 2>&1; then
    punya_docker=true
    ok "$(docker --version)"
  elif $root; then
    masalah "Docker terpasang tapi belum jalan. Nyalakan dulu: systemctl start docker"
  else
    masalah "User $(id -un) belum boleh memakai Docker. Sekali saja: sudo usermod -aG docker $(id -un), lalu keluar & masuk lagi ke VPS."
  fi
elif $root; then
  catatan "Docker belum terpasang — akan dipasang otomatis."
else
  masalah "Docker belum terpasang. Pasang sekali pakai sudo: curl -fsSL https://get.docker.com | sudo sh && sudo usermod -aG docker $(id -un), lalu keluar & masuk lagi ke VPS."
fi

# Port 80/443: boleh dipakai Caddy milik Kostera sendiri (saat memperbarui), selain itu berhenti.
caddy_kostera=""
if $punya_docker; then caddy_kostera=$(compose ps -q caddy 2>/dev/null || true); fi
if command -v ss >/dev/null; then
  port_bebas=true
  for port in 80 443; do
    if [[ -n "$(ss -Hltn "sport = :$port" 2>/dev/null)" && -z "$caddy_kostera" ]]; then
      # Nama program milik user lain hanya terlihat kalau skrip jalan sebagai root.
      pemakai=$(ss -Hltnp "sport = :$port" 2>/dev/null | grep -o 'users:(("[^"]*"' | cut -d'"' -f2 | sort -u | xargs || true)
      masalah "Port $port sudah dipakai ${pemakai:-program lain (namanya terlihat kalau dicek pakai sudo)}. Hentikan dulu program itu (mis. nginx/apache/panel hosting), atau tanyakan dulu kalau ragu."
      port_bebas=false
    fi
  done
  if $port_bebas; then ok "Port 80 & 443 siap"; fi
else
  catatan "Perintah ss tidak ada, port 80/443 tidak bisa dicek."
fi

if $punya_docker; then
  if [[ ! -f "$ENV_FILE" ]] && [[ -n "$(docker ps -aq --filter "label=com.docker.compose.project=$PROJECT")$(docker volume ls -q --filter "label=com.docker.compose.project=$PROJECT")" ]]; then
    masalah "Sudah ada container/volume Docker '$PROJECT' padahal deploy/vps/.env belum ada. Jangan lanjut — kabari dulu."
  fi
  lain=$(docker ps --format '{{.Names}}' | grep -v "^${PROJECT}-" | xargs || true)
  if [[ -n "$lain" ]]; then catatan "Container lain di VPS ini (tidak disentuh): $lain"; fi
fi

sumber_domain="$ENV_FILE"
[[ -f "$ENV_FILE" ]] || sumber_domain="$DIR/env.contoh"
landing=$(nilai KOSTERA_DOMAIN_LANDING "$sumber_domain")
app=$(nilai KOSTERA_DOMAIN_APP "$sumber_domain")
ip_vps=$(curl -4 -fsS --max-time 8 https://api.ipify.org 2>/dev/null || true)
echo "== DNS (arahkan ke IP VPS ini: ${ip_vps:-tidak terbaca}) =="
dns_siap=true
for domain in "$landing" "$app" "www.$landing"; do
  ip_domain=$(getent ahostsv4 "$domain" 2>/dev/null | awk 'NR==1 {print $1}' || true)
  if [[ -n "$ip_vps" && "$ip_domain" == "$ip_vps" ]]; then
    ok "$domain → $ip_domain"
  else
    catatan "$domain → ${ip_domain:-belum ada} (harus ${ip_vps:-IP VPS}). HTTPS baru aktif setelah ini benar."
    dns_siap=false
  fi
done

if $ada_masalah; then
  echo
  echo "Berhenti: perbaiki dulu yang bertanda ✗, lalu jalankan lagi. Belum ada yang diubah."
  exit 1
fi
if $CEK_SAJA; then
  echo
  echo "Pemeriksaan selesai, belum ada yang diubah. Pasang dengan: bash deploy/vps/pasang.sh"
  exit 0
fi

if ! $punya_docker; then # hanya sampai sini sebagai root; user biasa sudah dihentikan di atas
  echo "== Memasang Docker =="
  curl -fsSL https://get.docker.com | sh
fi

if [[ ! -f "$ENV_FILE" ]]; then
  # Rahasia dibuat di sini dan langsung ditulis ke file (izin 600) — tidak pernah ditampilkan.
  umask 077
  pw=$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')
  rahasia=$(head -c 32 /dev/urandom | base64)
  while IFS= read -r baris; do
    case "$baris" in
      POSTGRES_PASSWORD=) echo "POSTGRES_PASSWORD=$pw" ;;
      BETTER_AUTH_SECRET=) echo "BETTER_AUTH_SECRET=$rahasia" ;;
      *) printf '%s\n' "$baris" ;;
    esac
  done <"$DIR/env.contoh" >"$ENV_FILE"
  unset pw rahasia
  ok "deploy/vps/.env dibuat (kata sandi database & BETTER_AUTH_SECRET diisi acak, tidak ditampilkan)"
fi
chmod 600 "$ENV_FILE"
[[ -n "$(nilai POSTGRES_PASSWORD)" && $(nilai BETTER_AUTH_SECRET | wc -c) -gt 32 ]] ||
  { echo "  ✗ POSTGRES_PASSWORD/BETTER_AUTH_SECRET di deploy/vps/.env kosong atau terlalu pendek."; exit 1; }

backup_dir=$(nilai KOSTERA_BACKUP_DIR)
if [[ -z "$backup_dir" ]] && ! $root; then
  # User biasa tidak bisa menulis ke /var/backups: simpan di home, berkasnya dimiliki user ini.
  backup_dir="$HOME/kostera-backup"
  printf 'KOSTERA_BACKUP_DIR=%s\nKOSTERA_BACKUP_UID=%s\n' "$backup_dir" "$(id -u)" >>"$ENV_FILE"
fi
backup_dir=${backup_dir:-/var/backups/kostera}
install -d -m 700 "$backup_dir"

echo "== Build aplikasi (pertama kali bisa 5–15 menit) =="
compose build app

if docker volume inspect "${PROJECT}_db" >/dev/null 2>&1; then
  echo "== Backup database sebelum migrasi =="
  compose run --rm jadwal backup
fi

echo "== Migrasi database =="
compose up -d db
compose run --rm app npm run db:migrate

echo "== Cek konfigurasi produksi =="
compose run --rm app npm run cek:produksi ||
  catatan "Ada galat konfigurasi di atas. Wajar selama WhatsApp/Xendit belum diisi (tahap 2–3); landing tetap jalan."

echo "== Menjalankan layanan =="
compose up -d --remove-orphans
app_jalan=false
for _ in $(seq 1 60); do
  if compose exec -T app node -e "fetch('http://127.0.0.1:3000/masuk').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))" 2>/dev/null; then
    app_jalan=true
    break
  fi
  sleep 2
done
if $app_jalan; then ok "Aplikasi jalan"; else
  echo "  ✗ Aplikasi belum menjawab setelah 2 menit. Lihat log: docker compose -f deploy/vps/compose.yaml logs --tail 100 app"
  exit 1
fi
docker image prune -f --filter "label=kostera.app=1" >/dev/null

echo
echo "Selesai."
if $dns_siap; then
  echo "  Landing  : https://$landing"
  echo "  Aplikasi : https://$app"
else
  echo "  DNS belum mengarah ke VPS ini. Di Cloudflare (DNS → Records), buat record A untuk"
  echo "  $landing, app, dan www → ${ip_vps:-IP VPS} dengan Proxy status: DNS only (awan abu-abu)."
  echo "  Sertifikat HTTPS dibuat otomatis beberapa menit setelah DNS benar — tidak perlu pasang ulang."
fi
echo "  Backup   : $backup_dir (tiap hari 02.00 WIB)"
echo "  Log      : docker compose -f deploy/vps/compose.yaml logs -f app"
