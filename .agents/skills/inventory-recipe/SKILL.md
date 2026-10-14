---
name: inventory-recipe
description: Stok bahan, resep produk, pengurangan stok otomatis, pembelian bahan, stok opname, dan peringatan stok menipis. Gunakan skill ini setiap kali menyentuh stok, resep, bahan baku, pembelian, waste, atau opname.
---

# Inventory & Recipe

## Pengurangan stok
- Stok berkurang berdasarkan resep saat order berstatus PLACED, bukan COMPLETED.
- Lakukan dalam satu `prisma.$transaction` bersama pembuatan order.
- Modifier juga bisa mengurangi stok (extra shot = +18 g kopi).
- Catat setiap perubahan di `StockMovement` (SALE, PURCHASE, WASTE, ADJUSTMENT, VOID_RETURN); jangan hanya mengubah angka saldo.
- Hindari balapan stok: pakai decrement bersyarat atau `SELECT ... FOR UPDATE`.

## Satuan
Simpan dalam satuan terkecil (gram, ml). Konversi (kg -> g) di satu helper.

## Peringatan
- Tiap ingredient punya `minStock`; tampilkan peringatan saat di bawahnya.
- Bahan mudah rusak (susu) punya tanggal kedaluwarsa; gunakan FIFO.

## Stok opname
Selisih fisik vs sistem dicatat sebagai movement ADJUSTMENT dengan alasan.

## Edge case wajib dites
Stok tidak cukup, dua order bersamaan untuk stok terakhir, refund, resep berubah.
