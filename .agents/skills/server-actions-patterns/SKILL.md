---
name: server-actions-patterns
description: "Pola Server Action Next.js yang aman dan konsisten. Gunakan skill ini saat menulis atau merapikan mutasi data lewat Server Action."
---

# Server Actions Patterns

## Pola
1. Tandai berkas atau fungsi dengan "use server".
2. Urutan di dalam action: autentikasi dan otorisasi -> validasi Zod -> logika bisnis (fungsi murni di features/) -> tulis database dalam transaksi -> audit log bila sensitif -> revalidate.
3. Kembalikan `{ ok: true, data } | { ok: false, error: { code, message, fieldErrors? } }`.
4. Jangan bocorkan error mentah database ke klien; log detail di server.
## Aturan
- Anggap input Server Action sebagai input publik yang tidak tepercaya; cek otorisasi di setiap action walau tombolnya disembunyikan.
- Jangan menerima `outletId` dari klien sebagai kebenaran; ambil dari sesi.
- Action yang menyentuh uang menerima idempotency key (skill idempotency).
- Sesuaikan dengan API versi Next.js yang terpasang (cek dokumentasi resmi untuk perubahan seperti cookies/headers asinkron).
