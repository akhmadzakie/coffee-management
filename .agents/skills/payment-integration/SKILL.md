---
name: payment-integration
description: Integrasi pembayaran QRIS/kartu lewat payment gateway (misalnya Midtrans atau Xendit), webhook, dan status pembayaran online. Gunakan skill ini setiap kali mengerjakan pembayaran non-tunai, callback gateway, atau rekonsiliasi pembayaran.
---

# Payment Integration

1. Kunci API hanya di environment server, tidak pernah di client.
2. Buat pembayaran dari server; simpan `idempotencyKey` dan referensi gateway di tabel Payment.
3. Status final ditentukan oleh webhook gateway, bukan redirect atau klien.
4. Webhook wajib: verifikasi tanda tangan, idempoten (event sama diproses sekali), respons cepat.
5. Pembayaran pending punya batas waktu dan job pembersih.
6. Gunakan mode sandbox saat development. Baca dokumentasi resmi gateway yang dipilih untuk endpoint dan format tanda tangan; jangan menebak.
