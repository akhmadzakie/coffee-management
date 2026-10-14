---
name: thermal-printer-escpos
description: "Cetak ke printer thermal dengan perintah ESC/POS. Gunakan skill ini saat menghubungkan printer struk (USB, jaringan, atau Bluetooth) dan mencetak struk langsung tanpa dialog cetak browser."
---

# Thermal Printer Escpos

## Konteks
Sebagian besar printer thermal memakai set perintah ESC/POS (inisialisasi `ESC @`, potong kertas `GS V`, buka laci `ESC p`), tetapi detail dan dukungan berbeda per merek dan model. Baca manual printer yang dipakai.
## Pilihan koneksi
- Browser: Web Serial/WebUSB/Web Bluetooth hanya didukung di browser berbasis Chromium dan butuh izin pengguna serta HTTPS.
- Agen cetak lokal kecil di komputer kasir yang menerima job dari aplikasi.
- Printer jaringan (TCP, biasanya port 9100) dikirim dari server atau agen lokal.
## Aturan
- Bangun struk dari data snapshot order di satu modul penyusun (teks + perintah), terpisah dari transport.
- Kolom dengan lebar karakter tetap (mis. 32 untuk 58 mm, 48 untuk 80 mm; verifikasi pada printer Anda).
- Tangani kegagalan cetak (kertas habis, printer mati) dengan tombol cetak ulang; pembayaran tidak boleh gagal karena printer.
- Fallback ke cetak browser (print-css).
