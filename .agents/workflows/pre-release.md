---
description: Pemeriksaan sebelum rilis
---
1. Jalankan `npm run check` dan laporkan hasilnya.
2. Periksa migrasi Prisma yang belum diterapkan dan risikonya.
3. Periksa semua environment variable yang dibutuhkan sudah terdokumentasi.
4. Tinjau fitur yang menyentuh uang dan stok (total, pembayaran, stok, refund).
5. Pastikan tidak ada secret di repositori.
6. Buat daftar risiko dan rekomendasi: siap rilis atau belum.
