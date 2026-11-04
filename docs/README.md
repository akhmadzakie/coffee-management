# 📚 Katalog Buku Panduan Resmi — Julia's Coffee POS & Management

Dokumentasi resmi Standard Operating Procedure (SOP) dan Buku Panduan Pengguna (*User Manual*) yang telah disusun secara modular berdasarkan peran (*Role-Based Access Control*), lengkap dengan diagram alur visual, tabel DO & DON'T, skenario lapangan, dan panduan teknis.

---

## 🗂️ Daftar Seri Buku Panduan (PDF & HTML)

| No | Modul / Buku | Target Peran (*Role*) | File Dokumen HTML | File PDF Siap Cetak |
| :-: | :--- | :--- | :--- | :--- |
| **⚡** | **Lembar Meja Kasir (Cheat Sheet)** | `KASIR` | [cheat-sheet-kasir-A4.html](./cheat-sheet/cheat-sheet-kasir-A4.html) | [cheat-sheet-kasir-A4.pdf](./cheat-sheet/cheat-sheet-kasir-A4.pdf) |
| **1** | **Buku 1: Panduan Kasir & Operasional Bar** | `KASIR`, `BAR`, `KITCHEN`, `BAKER` | [panduan-kasir-barista.html](./buku-1-kasir-barista/panduan-kasir-barista.html) | [panduan-kasir-barista.pdf](./buku-1-kasir-barista/panduan-kasir-barista.pdf) |
| **2** | **Buku 2: Operasional & Pengawasan Toko** | `LEADER`, `MANAGER` | [panduan-manager-leader.html](./buku-2-manager-leader/panduan-manager-leader.html) | [panduan-manager-leader.pdf](./buku-2-manager-leader/panduan-manager-leader.pdf) |
| **3** | **Buku 3: Keuangan & Pembukuan** | `FINANCE` | [panduan-finance.html](./buku-3-finance/panduan-finance.html) | [panduan-finance.pdf](./buku-3-finance/panduan-finance.pdf) |
| **4** | **Buku 4: Pemilik Usaha (Mode Pantau)** | `OWNER` | [panduan-owner.html](./buku-4-owner/panduan-owner.html) | [panduan-owner.pdf](./buku-4-owner/panduan-owner.pdf) |
| **5** | **Buku 5: Teknis & Konfigurasi Sistem** | `SUPER_ADMIN` | [panduan-super-admin.html](./buku-5-super-admin/panduan-super-admin.html) | [panduan-super-admin.pdf](./buku-5-super-admin/panduan-super-admin.pdf) |

---

## 🖨️ Cara Kompilasi Ulang ke PDF (Jika Ada Perubahan HTML)

Jalankan perintah PowerShell berikut:
```powershell
powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\.gemini\antigravity\skills\interactive-guide-pdf\scripts\export-pdf.ps1" -InputHtml "docs/buku-X/panduan.html" -OutputPdf "docs/buku-X/panduan.pdf"
```

