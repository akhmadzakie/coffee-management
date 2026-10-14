---
name: kitchen-display-system
description: "Layar dapur/bar (KDS) yang menampilkan antrean pesanan. Gunakan skill ini saat membuat tampilan untuk barista dan dapur."
---

# Kitchen Display System

## Aturan
- Kartu per order berurutan waktu; nomor order dan jenis (dine-in/takeaway) besar; modifier ditebalkan.
- Aksi satu ketukan: mulai (PREPARING), siap (READY); tidak ada langkah tambahan.
- Pewarnaan menunggu lama (mis. > 5 menit) disertai ikon atau teks, bukan warna saja.
- Pembaruan langsung (realtime-ui) dan bunyi order baru (sound-notifications).
- Filter per stasiun (bar, dapur) bila produk dipetakan ke stasiun.
- Tahan terhadap koneksi putus: tampilkan status koneksi dan sinkron ulang.
- Tanpa data pembayaran di layar dapur.
