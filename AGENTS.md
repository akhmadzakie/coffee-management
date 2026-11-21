# AGENTS.md — Pedoman Wajib Sistem Julia's ERP & POS

Panduan ini berlaku otomatis untuk seluruh pengerjaan modul, perbaikan, dan UI/UX pada proyek **Julia's • Specialty Room • Coffee • Eatery**.

## 1. Stack & Arsitektur Proyek
- **Frontend:** React 19 + Vite + TypeScript + Tailwind CSS v4 (`@tailwindcss/vite`, sumber token di `src/index.css`) + `motion/react` (`motion`) + `lucide-react` + `recharts`.
- **Backend & DB:** Express Monolith (`server.ts`) + PostgreSQL + Drizzle ORM (`src/db/schema.ts`).
- **Navigasi File Besar:** Wajib cek [`CODEBASE_MAP.md`](file:///c:/Users/User/Documents/coffee%20management/CODEBASE_MAP.md) atau gunakan pencarian baris terlebih dahulu sebelum membaca file besar (`server.ts`, `StoreContext.tsx`, `CashFlow.tsx`, `Sales.tsx`, `Inventory.tsx`, `HRManagement.tsx`, `Payroll.tsx`). Perbarui `CODEBASE_MAP.md` jika menambah tabel, endpoint, atau komponen besar baru.

## 2. Standar Wajib UI/UX (Julia's Brand Design)
Setiap kali membuat atau mengubah tampilan, halaman, komponen, modal, form, tabel, grafik, atau alur POS/KDS, **wajib membaca dan mengikuti** [`.agents/skills/julias-brand-design/SKILL.md`](file:///c:/Users/User/Documents/coffee%20management/.agents/skills/julias-brand-design/SKILL.md) (beserta `references/components.md` dan `references/tokens.css`).

Ringkasan aturan yang **tidak boleh dilanggar**:
- **Palet & Anti-Flat Visual Depth:**
  - Warna utama adalah biru brand `brand-600` (`#1b2cc0`), netral wajib `slate-*` (dilarang `gray`, `stone`, `zinc`, `neutral`). Jangan menulis kode warna hex mentah di JSX komponen (kecuali props warna seri grafik Recharts).
  - Gunakan 3 lapis kedalaman permukaan agar tampilan nyaman & tidak flat: canvas (`#f6f8ff`) -> kartu utama (`bg-white border-slate-200/90 rounded-2xl shadow-coffee-sm`) -> sub-blok/inset/filter bar (`bg-slate-50/90` atau `bg-brand-50/40`).
  - Kartu KPI/ringkasan memakai soft-tint halus (`bg-gradient-to-br from-{brand|emerald|rose|amber|sky}-50/60 via-white to-white`) sesuai konteks semantik; batasi `.bg-brand-gradient` maksimal 1 hero card per halaman.
  - Tombol aksi utama (`+ Tambah`, `Simpan`, `Bayar`) dan kartu aktif memakai `bg-brand-600 hover:bg-brand-700 text-white` (hindari hitam kaku `bg-slate-900` sebagai CTA utama).
  - Warna semantik (`emerald`, `amber`, `rose`, `sky`) selalu disertai ikon atau label teks.
- **Kompatibilitas Light & Dark Mode:**
  - Light Mode adalah bawaan; komponen & modul baru (termasuk KDS & POS Login) harus tetap harmonis dan terbaca jelas (`≥ 4.5:1`) bila mode gelap aktif (`dark:bg-slate-950`, `dark:bg-slate-900`, `dark:text-slate-100`, `dark:text-brand-300`, tint semantik `dark:bg-{c}-500/15 dark:border-{c}-500/30`).
- **Komponen Input, Konfirmasi & Notifikasi Wajib (No Native Browser Dialogs):**
  - Dropdown -> wajib [`CustomSelect`](file:///c:/Users/User/Documents/coffee%20management/src/components/common/CustomSelect.tsx) (dilarang `<select>`, `<optgroup>`).
  - Tanggal & Bulan -> wajib [`CustomDatePicker`](file:///c:/Users/User/Documents/coffee%20management/src/components/common/CustomDatePicker.tsx) & [`CustomMonthPicker`](file:///c:/Users/User/Documents/coffee%20management/src/components/common/CustomMonthPicker.tsx) (dilarang `<input type="date|month">`).
  - Konfirmasi penting/destruktif -> wajib [`ConfirmModal`](file:///c:/Users/User/Documents/coffee%20management/src/components/common/ConfirmModal.tsx) (dilarang `window.confirm()` / `confirm()` pada fitur baru).
  - Feedback ringan sukses/error -> wajib Toast animasi `motion/react` via `createPortal` atau banner inline beranimasi (dilarang `window.alert()` / `alert()` pada fitur baru).
- **Standar Animasi (`motion/react`):**
  - Selalu import dari `"motion/react"` (dilarang `"framer-motion"`).
  - Semua modal `fixed inset-0` wajib memakai `<AnimatePresence>` + backdrop `motion.div` fade (`0.18s easeOut`) + dialog card `motion.div` spring (`damping: 28, stiffness: 360`). Jika memakai `createPortal`, `<AnimatePresence>` harus berada di dalam portal.
  - Dropdown, toast, banner, dan panel buka-tutup wajib memakai `AnimatePresence` + `motion.div` tanpa kelas CSS `animate-in` / `animate-fade-in` yang bentrok.

## 3. Aturan Bisnis, Keamanan & Verifikasi
- Bahasa antarmuka: **Indonesia** sehari-hari yang ringkas dan jelas; nama simbol kode: **Inggris**.
- Uang Rupiah selalu bilangan **integer** (`Math.round`), diformat lewat `formatCurrency` (`src/utils/format.ts`), dan memakai `tabular-nums`.
- Perubahan pada stok, HPP, pajak, kas, atau otorisasi wajib menghormati hak akses role & memakai skill domain terkait di `.agents/skills/`.
- Sebelum menyatakan pekerjaan selesai, wajib verifikasi dengan `npm run lint`, `npm test`, dan `npm run build` (plus audit statis bila menyentuh UI).
