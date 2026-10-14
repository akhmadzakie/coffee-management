---
name: idempotency
description: "Kunci idempotensi untuk operasi uang dan pembuatan data. Gunakan skill ini saat membuat pembayaran, order, refund, atau webhook yang tidak boleh diproses dua kali."
---

# Idempotency

## Aturan
- Klien membuat idempotency key unik per niat aksi (UUID) dan mengirimnya bersama permintaan.
- Server menyimpan key dengan hasil; permintaan ulang dengan key sama mengembalikan hasil yang sama, tanpa efek ganda.
- Batasan unik database (`@unique` pada key) sebagai pengaman akhir, bukan hanya pengecekan di kode.
- Key kedaluwarsa setelah jangka waktu wajar.
- Tombol dinonaktifkan saat proses, tetapi idempotensi tetap diperlukan (jaringan bisa mengulang).
- Uji: kirim dua kali bersamaan; hasil harus satu.
