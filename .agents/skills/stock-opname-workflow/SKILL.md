---
name: stock-opname-workflow
description: "Alur stok opname (hitung fisik) dan penyesuaian selisih. Gunakan skill ini saat membuat fitur hitung stok, audit stok, atau koreksi saldo bahan."
---

# Stock Opname Workflow

## Alur
1. Mulai sesi opname (snapshot stok sistem saat itu).
2. Petugas mengisi jumlah fisik per bahan (boleh dari ponsel).
3. Sistem menghitung selisih dan nilainya.
4. Manajer meninjau dan menyetujui.
5. Persetujuan membuat StockMovement ADJUSTMENT per selisih dengan alasan.
## Aturan
- Transaksi yang terjadi selama opname dihitung dari snapshot; tangani selisih akibat penjualan berjalan.
- Opname yang sudah disetujui tidak bisa diubah.
- Laporan selisih menampilkan bahan dengan selisih terbesar.
- Hitung buta (petugas tidak melihat angka sistem) adalah opsi untuk mengurangi bias.
