---
name: shadcn-components
description: "Pola pemakaian dan kustomisasi komponen shadcn/ui. Gunakan skill ini saat menambah komponen UI (button, dialog, sheet, select, table, form), mengubah gaya komponen, atau menyusun halaman dari komponen standar."
---

# Shadcn Components

## Aturan
- Tambahkan komponen lewat CLI shadcn resmi sesuai dokumentasi versi yang terpasang; periksa dokumentasi terbaru untuk perintahnya.
- Komponen disalin ke `src/components/ui/` dan boleh diubah; kustomisasi lewat token CSS dan varian, bukan menimpa kelas di setiap pemakaian.
- Bungkus pola yang berulang (mis. `ConfirmDialog`, `MoneyInput`, `PageHeader`) di `src/components/` agar konsisten.
- Dialog untuk keputusan penting, Sheet untuk panel samping atau bawah (cocok di tablet), Popover untuk pilihan ringan.
- Pastikan fokus, tombol Esc, dan label aksesibel tetap berfungsi setelah kustomisasi.
