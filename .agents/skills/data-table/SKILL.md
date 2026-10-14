---
name: data-table
description: "Tabel data dengan TanStack Table: sorting, filter, pagination, dan aksi baris. Gunakan skill ini saat membuat daftar produk, order, stok, pelanggan, atau tabel laporan."
---

# Data Table

## Aturan
- Untuk data besar, sorting, filter, dan pagination dilakukan di server (query database), bukan di klien.
- Simpan state tabel (halaman, filter, urutan) di query string agar bisa dibagikan dan bertahan saat refresh.
- Kolom angka dan uang rata kanan dengan `tabular-nums`.
- Header lengket, baris punya aksi di menu; area klik besar di tablet.
- Sediakan empty state, loading skeleton, dan error state.
- Seleksi massal untuk aksi aman saja; aksi destruktif butuh konfirmasi.
- Ekspor CSV mengikuti filter aktif.
