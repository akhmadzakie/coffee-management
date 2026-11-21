---
name: ui-design-system
description: "Prinsip ergonomi antarmuka (hierarki visual, state data, form, tabel, responsivitas, aksesibilitas) untuk aplikasi web coffee management. Gunakan bersama skill julias-brand-design setiap kali merancang atau merapikan tampilan."
---

# UI Design System (Ergonomi & Struktur Layar)

> **Prioritas Brand & Visual:** Untuk seluruh palet warna (`brand-*` `#1b2cc0`, `slate-*`, semantik, dark mode), lapisan permukaan anti-flat, komponen wajib (`CustomSelect`, `CustomDatePicker`, `CustomMonthPicker`, `ConfirmModal`, Toast `motion/react`), logo, dan aturan animasi, **selalu ikuti `.agents/skills/julias-brand-design/SKILL.md`**.

## Konteks Stack Aktual
- **Frontend:** React 19 + Vite + TypeScript + Tailwind CSS v4 (token utama di `src/index.css`, font **Plus Jakarta Sans** dimuat lewat `index.html`).
- **Ikon, Grafik & Motion:** `lucide-react`, `recharts`, `motion` (`motion/react`).
- **Komponen Bersama:** `src/components/common/` (`CustomSelect`, `CustomDatePicker`, `CustomMonthPicker`, `ConfirmModal`, `CsvImportExport`, `GenericImportModal`, `RupiahSign`).

## Prinsip Tata Letak & Hierarki
1. **Kejelasan di atas dekorasi:** Satu aksi utama (`bg-brand-600`) per area layar agar pengguna tahu ke mana harus mengklik terlebih dahulu.
2. **Permukaan Berlapis (Anti-Flat):** Pisahkan latar halaman (`#f6f8ff`), kartu utama (`bg-white` + border halus + `shadow-coffee-sm`), dan sub-panel/filter bar (`bg-slate-50/90` atau `bg-brand-50/40`), serta padukan dengan penyesuaian dark mode (`dark:bg-slate-950`, `dark:bg-slate-900`, `dark:bg-slate-800/70`).
3. **Hierarki Informasi:** Maksimal 2 skala ukuran teks utama dalam satu kartu KPI; gunakan ruang napas `p-4`/`p-5` dan `gap-4`.
4. **Angka Terukur:** Seluruh nilai Rupiah dan metrik wajib memakai `tabular-nums` dan helper `formatCurrency` (`src/utils/format.ts`).

## Pola Pengguna per Peran
- **Kasir (POS):** Target sentuh minimal `48x48 px`, tombol aksi utama tinggi ≥ `56 px` (`h-14`), kontras tinggi, minim langkah ketukan.
- **Barista / Dapur (KDS):** Kartu antrean terbaca cepat dari jarak jauh, modifier ditebalkan, status selalu disertai teks + ikon (bukan warna saja).
- **Owner / Manajer / Finance:** Dashboard ringkas (KPI soft-tinted → Grafik Recharts → Tabel rapi), mudah dipindai lintas bulan/cabang.

## Standar Komponen & Interaksi
- **Tombol:** Hierarki jelas — Primary (`bg-brand-600 text-white`), Secondary (`bg-white border-slate-200 text-slate-700`), Ghost (`hover:bg-slate-100`), Destructive (`bg-rose-600 text-white`).
- **Form:** Label jelas di atas input (`text-xs font-bold`), pesan error validasi di bawah input dalam bahasa Indonesia yang langsung memberi solusi, tombol submit menampilkan state loading agar mencegah klik ganda.
- **Dropdown & Picker Tanggal:** Wajib memakai `CustomSelect`, `CustomDatePicker`, dan `CustomMonthPicker` (tanpa elemen native browser).
- **Tabel Data:** Header tetap mudah dibaca (`bg-slate-50/90 dark:bg-slate-800/70`), kolom angka rata kanan (`tabular-nums`), filter/pencarian rapi, pagination jika data panjang, dan `overflow-x-auto` agar aman di layar kecil.
- **Konfirmasi & Umpan Balik:** Aksi berisiko/destruktif wajib memakai `ConfirmModal`; notifikasi ringan memakai Toast animasi `motion/react` (bukan dialog bawaan browser).

## 4 State Wajib di Setiap Halaman Data
1. **Loading:** Skeleton atau indikator proses yang rapi.
2. **Empty:** Ikon relevan + penjelasan singkat + tombol CTA untuk membuat data pertama.
3. **Error:** Pesan kesalahan bahasa Indonesia yang jelas + tombol coba lagi.
4. **Success:** Toast singkat atau banner konfirmasi animasi `motion/react`.

## Aksesibilitas & Bahasa Antarmuka
- Rasio kontras teks minimal **4.5:1** baik di light mode maupun dark mode.
- Fokus keyboard (`*:focus-visible`) tetap terlihat jelas; tombol ikon-saja wajib memiliki `aria-label` atau `title`.
- Hormati `prefers-reduced-motion` dan jaga durasi animasi singkat (150–250 ms).
- Gunakan bahasa Indonesia operasional yang ringkas dan natural (contoh: `"Stok susu oat tidak cukup untuk 2 porsi"`).
