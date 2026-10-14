---
name: role-access
description: Login, sesi, peran pengguna (OWNER, MANAGER, CASHIER, BARISTA), proteksi halaman, otorisasi server action, dan audit log. Gunakan skill ini setiap kali membuat fitur yang perlu pembatasan akses atau mencatat aksi sensitif.
---

# Role Access

## Peran
- OWNER: semua akses, termasuk pengaturan, laporan keuangan, manajemen pengguna.
- MANAGER: operasional, void/refund, stok, laporan outlet.
- CASHIER: membuat order, menerima pembayaran, buka/tutup shift sendiri.
- BARISTA: melihat antrean dan mengubah status PREPARING/READY.

## Aturan
1. Otorisasi dicek di server pada SETIAP Server Action dan Route Handler. Middleware atau menyembunyikan tombol hanya pelengkap.
2. Satu helper `requireRole(...roles)` di `lib/auth.ts`.
3. Satu matriks izin terpusat di `lib/permissions.ts` (`can(user, "order:void")`). Jangan menulis `if role === ...` tersebar.
4. Setiap query difilter `outletId` milik user agar data antar-outlet tidak bocor.
5. Password di-hash (argon2 atau bcrypt); jangan pernah disimpan atau di-log mentah.
6. Aksi sensitif (void, refund, ubah harga, hapus pengguna) dicatat di `AuditLog` (siapa, kapan, aksi, before/after).
7. Rate limit pada endpoint login.

## Test minimum
Kasir mencoba void (ditolak), user outlet A membaca data outlet B (ditolak), sesi kedaluwarsa.
