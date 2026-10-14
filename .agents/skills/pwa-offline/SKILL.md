---
name: pwa-offline
description: "PWA dan mode offline dengan antrean sinkronisasi. Gunakan skill ini saat membuat aplikasi bisa dipasang, cache aset, atau POS yang tetap bekerja saat internet putus."
---

# Pwa Offline

## Peringatan desain
Offline untuk transaksi uang itu rumit. Putuskan cakupannya dulu (hanya baca menu, atau juga membuat order) dan dokumentasikan.
## Aturan
- Cache aset dan data menu (read-only) lewat service worker; versi cache jelas.
- Order offline disimpan di penyimpanan lokal (IndexedDB) dengan id sementara dan idempotency key, lalu disinkronkan berurutan saat online (skill idempotency).
- Server menghitung ulang total dan memvalidasi stok saat sinkron; konflik ditampilkan ke manajer, bukan ditimpa diam-diam.
- Indikator online/offline dan jumlah antrean selalu terlihat.
- Pembayaran non-tunai tidak tersedia offline; tampilkan jelas.
- Uji skenario putus di tengah transaksi.
