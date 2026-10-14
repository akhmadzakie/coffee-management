---
name: zod-validation
description: "Skema validasi Zod bersama klien dan server. Gunakan skill ini saat memvalidasi form, Server Action, query string, atau data dari luar."
---

# Zod Validation

## Aturan
- Skema di `features/<domain>/schema.ts`, satu sumber untuk tipe (`z.infer`) dan validasi.
- Uang dan stok: `z.number().int().nonnegative()` dengan batas wajar.
- Teks: `trim()`, panjang maksimum; normalisasi sebelum validasi (telepon, email huruf kecil).
- Enum Zod selaras dengan enum Prisma.
- Gunakan `safeParse` dan petakan error ke `fieldErrors`.
- Pesan error dalam bahasa Indonesia, spesifik, dan konsisten.
- Data dari webhook atau API pihak ketiga juga divalidasi sebelum dipakai.
