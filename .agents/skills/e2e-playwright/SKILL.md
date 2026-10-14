---
name: e2e-playwright
description: "Tes end-to-end dengan Playwright untuk alur kasir. Gunakan skill ini saat membuat tes alur lengkap (login, buat order, bayar, cetak) atau tes regresi UI."
---

# E2E Playwright

## Aturan
- Fokus pada alur kritis: login, buka shift, buat order dengan modifier, bayar tunai, void oleh manajer, tutup shift.
- Database tes terpisah dengan data seed yang dikenal; reset antar tes atau antar suite.
- Selektor berbasis peran dan label aksesibel (`getByRole`), bukan kelas CSS rapuh.
- Tunggu kondisi (auto-wait), bukan `sleep`.
- Uji ukuran layar tablet.
- Jalankan di CI dan simpan trace/screenshot saat gagal.
- Sedikit tes e2e yang berharga lebih baik daripada banyak yang rapuh.
