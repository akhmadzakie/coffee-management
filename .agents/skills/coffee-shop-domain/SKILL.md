---
name: coffee-shop-domain
description: Istilah dan aturan bisnis coffee shop (produk, variant, modifier, bahan, resep, shift, pajak, uang). Gunakan skill ini setiap kali menulis atau mengubah fitur yang menyangkut menu, harga, pesanan, pajak, shift, atau data bisnis, bahkan jika pengguna tidak menyebutnya secara eksplisit.
---

# Coffee Shop Domain

## Istilah
- Product: item yang dijual (Latte, Croissant).
- Variant: ukuran atau jenis (Regular, Large; Hot, Iced).
- Modifier: tambahan (extra shot, oat milk, less sugar), bisa menambah harga.
- Ingredient: bahan baku (biji kopi, susu, sirup) dengan satuan (g, ml, pcs).
- Recipe: daftar ingredient dan takaran per variant produk.
- Shift: periode kerja kasir dengan kas awal dan kas akhir.

## Aturan wajib
1. Uang disimpan sebagai integer Rupiah (tanpa desimal). Jangan pakai float.
2. Harga di order item adalah snapshot saat transaksi. Perubahan harga menu tidak boleh mengubah order lama.
3. Pajak (misalnya PB1) dan service charge configurable per outlet (basis points), jangan hardcode.
4. Timestamp disimpan UTC, ditampilkan dalam zona waktu outlet (default Asia/Jakarta).
5. Data master (produk, bahan) memakai soft delete agar riwayat transaksi tetap valid.
6. Nomor order unik per outlet per hari, format: 20261007-0042.

## Saat menambah fitur
- Cek apakah fitur memengaruhi stok, laporan, atau kas shift.
- Tulis test untuk perhitungan total, diskon, dan pajak.
- Jika aturan bisnis tidak jelas, tanyakan ke pengguna, jangan menebak.
