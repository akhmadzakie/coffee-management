# Konteks Proyek
Web app manajemen coffee shop & back-office ERP/POS: arus kas, laporan keuangan, inventori & resep (HPP), pembelian (PO), HR/jadwal/absensi/payroll/KPI, checklist leader, dan modul kasir (POS/KDS).

## Stack Aktual Proyek
React 19 + Vite + TypeScript + Tailwind CSS v4 (`@tailwindcss/vite`) + `motion/react` + Recharts + Lucide Icons + Express Monolith (`server.ts`) + PostgreSQL + Drizzle ORM (`src/db/schema.ts`).

## Standar Wajib UI/UX (Julia's Brand Design)
- Acuan visual & komponen utama ada di [`AGENTS.md`](file:///c:/Users/User/Documents/coffee%20management/AGENTS.md) dan [`.agents/skills/julias-brand-design/SKILL.md`](file:///c:/Users/User/Documents/coffee%20management/.agents/skills/julias-brand-design/SKILL.md) (beserta `references/components.md` dan `references/tokens.css`).
- Gunakan token `brand-*` (`#1b2cc0`), netral `slate-*`, warna semantik + ikon/teks, lapisan permukaan anti-flat (soft-tinted KPI card & inset sub-panel), serta kompatibilitas Light/Dark Mode.
- Wajib memakai `CustomSelect`, `CustomDatePicker`, `CustomMonthPicker`, `ConfirmModal`, Toast `motion/react`, dan import dari `"motion/react"` untuk seluruh fitur/modul baru. Dilarang memakai native `<select>`, `<input type="date|month">`, `"framer-motion"`, maupun dialog browser polos (`window.alert`/`window.confirm`).

## Aturan Navigasi & Penghematan Token (Pinpoint Index)
- **WAJIB BACA [`CODEBASE_MAP.md`](file:///c:/Users/User/Documents/coffee%20management/CODEBASE_MAP.md) TERLEBIH DAHULU** sebelum membaca file berukuran besar (`server.ts`, `StoreContext.tsx`, `HRManagement.tsx`, `Inventory.tsx`, `Payroll.tsx`, `CashFlow.tsx`, `Sales.tsx`, dll.).
- Gunakan nomor baris (`StartLine` dan `EndLine`) dari `CODEBASE_MAP.md` atau `Select-String` untuk langsung membaca bagian fungsi/komponen/endpoint yang relevan saja. **Jangan membaca keseluruhan file besar dari baris 1.**
- Jika Anda menambah tabel, endpoint API, atau fungsi besar baru yang menggeser posisi baris secara signifikan, perbarui `CODEBASE_MAP.md`.

## Aturan Umum
- Bahasa UI: Indonesia. Nama variabel dan kode: Inggris.
- Uang selalu bulat (Rupiah). Hindari ketidakakuratan floating-point untuk uang atau stok.
- Jangan menjalankan perintah destruktif (drop, reset database, rm -rf) tanpa konfirmasi pengguna.
- Jangan menambah dependency baru tanpa menyebut alasannya.
- Fitur yang menyentuh uang atau stok wajib diverifikasi dengan hati-hati.
- Gunakan skill yang relevan di `.agents/skills` sebelum menulis kode.
- Jika ragu soal aturan bisnis, tanyakan, jangan menebak.
