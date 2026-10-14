---
name: prisma-migration-safety
description: Aturan schema Prisma, migrasi database, seed, dan query yang menyangkut uang dan stok. Gunakan skill ini setiap kali mengubah schema.prisma, membuat migrasi, menulis seed, atau menulis query Prisma lintas tabel.
---

# Prisma Migration Safety

Skema lengkap proyek ada di `references/schema.prisma` (salin ke `prisma/schema.prisma` saat memulai).

## Schema
- Uang dan stok bertipe `Int` (Rupiah, gram/ml), bukan Float.
- Tiap tabel punya `createdAt`, `updatedAt`; data master punya `deletedAt` (soft delete).
- Index pada kolom yang sering difilter (`outletId`, `status`, `completedAt`).
- Enum untuk status order, metode pembayaran, dan peran.
- Pajak dan service charge disimpan dalam basis points (1000 = 10%).

## Migrasi
1. Gunakan `prisma migrate dev` untuk membuat migrasi dan `migrate deploy` di produksi. Jangan `db push` di produksi.
2. Jangan menghapus atau mengganti nama kolom langsung: tambah kolom baru, salin data, ganti kode, baru hapus kolom lama.
3. Kolom NOT NULL baru pada tabel berisi data wajib punya default atau backfill.
4. Ingatkan pengguna untuk backup database sebelum migrasi destruktif. Jangan menjalankan reset database tanpa konfirmasi.

## Query
- Operasi lintas tabel (order + pembayaran + stok) wajib dalam `prisma.$transaction`.
- Pengurangan stok atomik (decrement bersyarat atau `SELECT ... FOR UPDATE`).
- Hindari N+1: gunakan `include` atau `select` yang tepat.
