---
name: sales-reports
description: Dashboard dan laporan penjualan, laporan shift, produk terlaris, jam ramai, metode pembayaran, HPP dan margin. Gunakan skill ini setiap kali membuat laporan, grafik, agregasi data, ekspor CSV, atau angka ringkasan untuk owner.
---

# Sales Reports

## Definisi (jangan diubah tanpa persetujuan)
- Penjualan kotor = jumlah subtotal order COMPLETED.
- Penjualan bersih = kotor - diskon - refund.
- HPP = jumlah biaya bahan dari resep untuk item terjual.
- Margin = (penjualan bersih - HPP) / penjualan bersih.
- Hanya order COMPLETED yang dihitung.

## Aturan teknis
1. Agregasi di database (groupBy atau raw SQL), bukan menarik semua baris lalu menjumlah di JavaScript.
2. Rentang tanggal mengikuti zona waktu outlet (Asia/Jakarta), bukan UTC.
3. Filter: rentang tanggal, outlet, dan opsional kasir.
4. Index pada `Order(outletId, completedAt)`.
5. Laporan besar memakai pagination; ekspor CSV lewat Route Handler.
6. Uang dikirim ke UI sebagai integer, diformat di UI.

## Laporan standar
Ringkasan harian, produk terlaris, penjualan per jam, per metode pembayaran, laporan tutup shift (kas awal, tunai masuk, kas seharusnya vs aktual, selisih).
