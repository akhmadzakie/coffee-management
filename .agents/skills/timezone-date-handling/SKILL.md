---
name: timezone-date-handling
description: "Penanganan zona waktu dan batas hari. Gunakan skill ini saat membuat laporan harian, jadwal, promo berbasis jam, atau menampilkan waktu."
---

# Timezone Date Handling

## Aturan
- Simpan semua timestamp dalam UTC; tampilkan dalam zona waktu outlet (default Asia/Jakarta).
- "Hari ini" dan "hari bisnis" dihitung di zona outlet: konversi batas awal dan akhir hari ke UTC untuk query.
- Pertimbangkan hari bisnis yang melewati tengah malam (kedai buka sampai dini hari) sebagai pengaturan outlet.
- Satu helper di `lib/dates.ts` untuk format dan batas rentang; jangan memakai `new Date()` sebarangan di UI.
- Gunakan pustaka tanggal yang andal untuk zona waktu atau `Intl`.
- Tes batas tengah malam dan pergantian bulan.
