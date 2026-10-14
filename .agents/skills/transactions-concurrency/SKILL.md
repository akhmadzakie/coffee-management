---
name: transactions-concurrency
description: "Transaksi database, locking, dan pencegahan balapan data. Gunakan skill ini saat beberapa tabel diubah bersamaan, stok bisa diperebutkan, atau nomor urut harus unik."
---

# Transactions Concurrency

## Aturan
- Operasi lintas tabel dalam `prisma.$transaction`.
- Stok: pengurangan atomik bersyarat (`UPDATE ... SET qty = qty - n WHERE qty >= n` dan periksa jumlah baris terpengaruh) atau `SELECT ... FOR UPDATE`.
- Nomor urut (nomor order, antrean): gunakan tabel penghitung dengan penguncian atau urutan database, bukan `max()+1`.
- Tentukan tingkat isolasi bila perlu dan tangani kegagalan serialisasi dengan coba ulang terbatas.
- Transaksi singkat; jangan memanggil API eksternal di dalam transaksi.
- Tulis tes yang menjalankan dua operasi paralel pada sumber daya terakhir.
