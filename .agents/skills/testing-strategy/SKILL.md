---
name: testing-strategy
description: Strategi testing (Vitest, integration test database) dan kriteria selesai. Gunakan skill ini setiap kali menulis test, memperbaiki bug, atau sebelum menyatakan fitur selesai.
---

# Testing Strategy

- Unit test (Vitest) untuk fungsi murni: total order, konversi satuan, aturan stok.
- Integration test untuk Server Action yang menyentuh database; gunakan database test terpisah dan bersihkan data tiap test.
- Setiap bug: tulis test yang gagal dulu, lalu perbaiki.
- Wajib dites: stok tidak cukup, klik ganda pembayaran, akses lintas outlet, refund.
- Sebelum menyatakan selesai jalankan `npm run check` dan laporkan hasilnya apa adanya.
