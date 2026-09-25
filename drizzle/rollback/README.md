# Rollback migrasi

Migrasi Drizzle di folder `drizzle/` hanya berjalan maju. Untuk migrasi yang punya pasangan di
folder ini, rollback dilakukan manual:

1. Kembalikan kode ke commit sebelum migrasi (git revert) supaya aplikasi tidak lagi memakai
   tabel/kolomnya.
2. Jalankan file `NNNN_*.down.sql` yang sesuai ke database (mis. `psql "$DATABASE_URL" -f …`).
   File ini juga menghapus catatan migrasi di `drizzle.__drizzle_migrations`, sehingga migrasi yang
   sama bisa dijalankan ulang nanti.

Data di tabel yang dihapus ikut hilang — ekspor dulu bila masih diperlukan.
