---
name: realtime-ui
description: "Pembaruan UI secara langsung (SSE, WebSocket, atau polling) untuk antrean, dapur, dan dashboard. Gunakan skill ini saat order baru harus muncul di layar lain tanpa refresh."
---

# Realtime Ui

## Pilihan
- Polling (mis. tiap 3-5 detik) paling sederhana dan cukup untuk satu outlet kecil.
- SSE untuk aliran satu arah dari server ke layar.
- WebSocket bila perlu dua arah. Ingat: hosting serverless tertentu membatasi koneksi panjang; cek platform deploy sebelum memilih.
## Aturan
- Klien mengambil ulang data otoritatif saat menerima sinyal; jangan mengandalkan isi pesan sebagai satu-satunya kebenaran.
- Sambung ulang otomatis dan tampilkan status koneksi.
- Filter event per outlet di server (role-access).
- Hindari render ulang berlebihan; perbarui hanya item yang berubah.
