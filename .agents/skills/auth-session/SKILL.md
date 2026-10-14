---
name: auth-session
description: "Autentikasi, sesi, dan cookie aman. Gunakan skill ini saat membuat login, logout, sesi, atau memilih pustaka autentikasi."
---

# Auth Session

## Aturan
- Gunakan pustaka autentikasi yang mapan dan terawat untuk Next.js (cek dokumentasi dan versi terbaru); jangan membuat kriptografi sendiri.
- Cookie sesi: `HttpOnly`, `Secure` di produksi, `SameSite` sesuai kebutuhan, masa berlaku jelas.
- Sesi menyimpan id pengguna, peran, dan outlet; periksa ulang peran di server pada aksi sensitif.
- Logout menghapus sesi di server.
- Kunci sesi atau rahasia di environment, diganti bila bocor.
- Kunci akun atau penundaan setelah percobaan login gagal berulang (rate-limiting).
- Pesan login generik ("email atau kata sandi salah").
