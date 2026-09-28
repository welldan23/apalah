#!/bin/sh
# Container "jadwal" di VPS (jam container = UTC):
#   tanpa argumen      → pasang crontab lalu jalankan crond
#   backup             → pg_dump database ke /backup, simpan 14 hari
#   panggil <nama>     → panggil /api/cron/<nama> di aplikasi (butuh CRON_SECRET)
# Log hanya berisi waktu + berhasil/gagal, tanpa isi respons (bisa memuat data penyewa).
set -eu
umask 077 # berkas backup hanya bisa dibaca root

waktu() { date -u +%Y-%m-%dT%H:%M:%SZ; }

backup() {
  berkas="/backup/kostera-$(date -u +%Y%m%d-%H%M%S).dump"
  if pg_dump -h db -U kostera -d kostera --format=custom --no-owner -f "$berkas.tmp"; then
    mv "$berkas.tmp" "$berkas"
    echo "$(waktu) backup ok: $(basename "$berkas")"
  else
    rm -f "$berkas.tmp"
    echo "$(waktu) backup GAGAL"
    return 1
  fi
  find /backup -name 'kostera-*.dump' -mtime +14 -delete
}

panggil() {
  if galat=$(wget -q -O /dev/null -T 600 --header "Authorization: Bearer $CRON_SECRET" "http://app:3000/api/cron/$1" 2>&1); then
    echo "$(waktu) cron $1 ok"
  else
    echo "$(waktu) cron $1 GAGAL: $(echo "$galat" | tail -1)"
  fi
}

case "${1:-}" in
  backup) backup ;;
  panggil) panggil "$2" ;;
  "")
    log=/proc/1/fd/1
    # Backup tiap hari 02.00 WIB (19.00 UTC).
    echo "0 19 * * * sh /jadwal.sh backup >> $log 2>&1" > /etc/crontabs/root
    if [ -n "${CRON_SECRET:-}" ]; then
      # Tagihan & pekerjaan harian 00.05 WIB; pengingat dicek tiap jam supaya terkirim tepat jamnya.
      echo "5 17 * * * sh /jadwal.sh panggil harian >> $log 2>&1" >> /etc/crontabs/root
      echo "5 * * * * sh /jadwal.sh panggil pengingat >> $log 2>&1" >> /etc/crontabs/root
      echo "$(waktu) jadwal aktif: backup harian, cron harian & pengingat"
    else
      echo "$(waktu) CRON_SECRET kosong: hanya backup harian; tagihan & pengingat otomatis nonaktif"
    fi
    exec crond -f -d 8
    ;;
  *) echo "Pakai: jadwal.sh [backup | panggil <harian|pengingat>]" >&2; exit 2 ;;
esac
