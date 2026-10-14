---
name: form-patterns
description: "Pola form dengan react-hook-form dan Zod: validasi, error, loading, dan Server Action. Gunakan skill ini saat membuat atau memperbaiki form input apa pun."
---

# Form Patterns

## Aturan
- Satu skema Zod dipakai di klien dan server; server tetap memvalidasi ulang.
- Label di atas input, error di bawah input dengan bahasa Indonesia yang jelas.
- Tombol submit nonaktif dan menampilkan loading saat proses; cegah submit ganda.
- Field uang memakai komponen input angka yang menyimpan Int Rupiah, menampilkan format ribuan, dan tidak menerima desimal.
- Fokus ke field error pertama saat validasi gagal.
- Pertahankan input saat error server; jangan mengosongkan form.
- Hasil Server Action berbentuk `{ ok, data | error }` dan dipetakan ke error field bila ada.
