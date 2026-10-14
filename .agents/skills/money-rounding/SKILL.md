---
name: money-rounding
description: "Aturan uang Rupiah: integer, pembulatan, dan format. Gunakan skill ini setiap kali menghitung, menyimpan, atau menampilkan uang."
---

# Money Rounding

## Aturan
- Simpan dan hitung dalam Int Rupiah; tidak pernah Float.
- Persentase memakai basis points; satu fungsi pembulatan (`Math.round`) di `lib/money.ts` dan dipakai di mana-mana.
- Pembulatan total ke kelipatan (mis. Rp100) adalah kebijakan outlet; simpan selisih pembulatan sebagai kolom sendiri.
- Format tampilan lewat `Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 })`.
- Jangan menjumlah angka yang sudah dibulatkan jika bisa menjumlah nilai asli lebih dulu; tentukan aturan pembulatan per baris atau per total dan konsisten.
- Tes: nilai batas (0, 1, 499, 500), jumlah besar, diskon, dan pajak bersusun.
