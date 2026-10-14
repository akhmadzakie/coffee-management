---
name: order-flow
description: Alur pesanan, perhitungan total, pembayaran, split bill, void, refund, dan status order. Gunakan skill ini setiap kali mengerjakan pembuatan order, keranjang, pembayaran, kembalian, void, refund, atau transisi status pesanan.
---

# Order Flow

## Status pesanan
DRAFT -> PLACED -> PREPARING -> READY -> COMPLETED
Cabang: PLACED/PREPARING -> CANCELLED, COMPLETED -> REFUNDED (sebagian atau penuh).
Transisi status lewat satu fungsi terpusat yang memvalidasi urutan.

## Perhitungan total (urutan tetap)
subtotal -> diskon -> service charge -> pajak -> pembulatan -> total
Gunakan fungsi murni di `references/calculate-totals.ts` (salin ke `src/features/orders/`) beserta `money.ts` (ke `src/lib/`) dan test-nya. Frontend boleh menghitung untuk tampilan, tetapi backend selalu menghitung ulang saat order dibuat.
Asumsi urutan: diskon dulu, service charge dari nilai setelah diskon, pajak dari (setelah diskon + service charge). Konfirmasi ke pemilik kedai jika berbeda.

## Pembayaran
- Mendukung tunai, QRIS, kartu. Satu order boleh punya beberapa pembayaran (split).
- Order COMPLETED hanya jika total pembayaran >= total tagihan.
- Kembalian dihitung di backend.
- Gunakan idempotency key agar klik ganda tidak membuat pembayaran ganda.

## Void dan refund
- Wajib alasan dan user pelaku; hanya manajer ke atas.
- Jangan hapus data; buat catatan baru (audit trail).
- Refund mengembalikan stok hanya jika barang belum diproses.

## Test minimum
Total dengan modifier, diskon + pajak, split bill, pembayaran kurang, klik ganda.
