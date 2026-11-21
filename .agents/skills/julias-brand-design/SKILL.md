---
name: julias-brand-design
description: "Identitas visual dan aturan UI/UX resmi Julia's Specialty Room • Coffee • Eatery: palet biru brand #1b2cc0, lapisan permukaan anti-flat, kartu KPI soft-tinted, kesiapan mode gelap, pemakaian logo, komponen umum wajib (CustomSelect, CustomDatePicker, CustomMonthPicker, ConfirmModal, Toast), standar animasi motion/react, serta pola layar (Sidebar, CashFlow, Dashboard, POS, KDS, struk, PWA). Gunakan skill ini SETIAP KALI membuat atau mengubah tampilan apa pun."
---

# Julia's Brand & UI/UX Design Reference

Klien: **Julia's** — tagline resmi **"Specialty Room • Coffee • Eatery"**.
Kesan visual: modern, berani, bersih, nyaman dipandang lama, membulat (terinspirasi ikon rumah dengan bintang empat sudut). **Bukan** tema kopi cokelat/krem.

---

## 1. Prioritas Skill & Stack Aktual
- **Prioritas UI/UX:** Untuk warna, nuansa, permukaan anti-flat, komponen input/modal wajib, logo, dan motion di Julia's, **skill ini adalah acuan utama**; skill `.agents/skills/ui-design-system/SKILL.md` melengkapi dari sisi ergonomi informasi, state halaman, tabel, form, dan aksesibilitas.
- **Alur & Domain:** Tetap ikuti skill terkait fitur yang dikerjakan (`pos-ui-design`, `kitchen-display-system`, `data-table`, `form-patterns`, `money-rounding`, `coffee-shop-domain`).
- **Stack Nyata Repo:** **React 19 + Vite + TypeScript + Tailwind CSS v4** (`@tailwindcss/vite`), `lucide-react`, `recharts`, `motion` (`motion/react`), Express + Drizzle ORM (PostgreSQL).
- **Sumber Kebenaran Token:** Blok `@theme` di `src/index.css` (snapshot ada di `references/tokens.css`; font **Plus Jakarta Sans** dimuat melalui `index.html`).

---

## 2. Palet Brand, Netral & Semantik

| Token Tailwind | Hex | Pemakaian |
|---|---|---|
| `brand-600` | `#1b2cc0` | **Warna aksi & identitas utama**: tombol primary, link, tab/item aktif, header aksen |
| `brand-700` / `800` | `#1624a0` / `#121d80` | Hover/active tombol primary, teks aksen di atas `brand-50/100` |
| `brand-900` / `950` | `#0f1860` / `#0a1040` | Permukaan gelap (hero card gelap, sidebar band, latar dark mode), judul beraksen |
| `brand-500` | `#4a5ff0` | Focus ring, grafik sekunder, hover ringan, aksen tombol pada dark mode |
| `brand-400` | `#7692ff` | Gradasi ikon & dekoratif (bukan untuk teks kecil di latar terang) |
| `brand-300` / `brand-sky` | `#a8bcff` / `#a2c5fb` | Teks/ikon aksen di atas latar gelap (`brand-900`/`slate-950`) |
| `brand-50` / `100` / `200` | `#eef2ff` / `#dfe6ff` / `#c3cfff` | Latar item aktif, tint lembut KPI, sub-panel, border aksen |
| `slate-*` | — | **Semua netral**: teks, border, latar sub-panel |
| Latar halaman | `#f6f8ff` | Canvas dasar aplikasi di Light Mode (diatur di `src/index.css`) |

### Aturan Warna (Wajib)
1. **Aksen = `brand-*`.** Dilarang memakai `amber`, `orange`, `stone`, `yellow`, `indigo`, atau `blue` sebagai warna aksen brand. Pengecualian resmi hanya untuk status semantik (`amber` = peringatan/menunggu/periode terkunci) dan **palet lencana peran** di bawah.
2. **Netral = `slate-*`.** Dilarang memakai `gray`, `stone`, `zinc`, `neutral`.
3. **Tanpa hex di komponen JSX.** Satu-satunya pengecualian: props warna pada grafik Recharts — gunakan urutan:
   `["#1b2cc0", "#7692ff", "#0f1860", "#a2c5fb", "#059669", "#e11d48"]`
4. **Kontras ≥ 4.5:1:** Putih di atas `brand-600` (9.7:1), `brand-600` di atas putih (9.7:1), `brand-500` di atas putih (5.0:1). Di atas latar terang jangan pakai `brand-400` untuk teks kecil; di atas `brand-600`/gelap pakai `white`, `brand-300`, atau `brand-sky`.
5. **Teks utama & sekunder:** `slate-900` (utama), `slate-600` (sekunder), paling terang `slate-500` untuk keterangan penting.
6. **Warna bukan satu-satunya pembeda:** Status dan grafik wajib disertai ikon, label teks, atau pola.

**Warna Semantik Status (Terpisah dari Brand):**
Sukses = `emerald-600/700` · Peringatan = `amber-500..700` · Bahaya/Error = `rose-600/700` · Info = `sky-600`.
Status pesanan seragam di seluruh aplikasi: Menunggu = `amber` · Diproses = `brand` · Siap = `emerald` · Selesai = `slate` · Batal/Void = `rose` · Info = `sky`.

**Palet Lencana Peran (Pengecualian Resmi):**
Owner = `brand` · Manager = `violet` · Finance = `sky` · Kasir = `emerald` · Leader = `orange` · Staff = `slate`.
- Latar terang: `text-{c}-800 bg-{c}-50 border border-{c}-200`
- Latar gelap: `bg-{c}-500/15 text-{c}-300 border border-{c}-500/30`

---

## 3. Kedalaman Visual Anti-Flat (Gold Standard: `CashFlow` & `Dashboard`)
Agar halaman bersih namun **tidak terasa pucat/monoton** ("putih ketemu putih") dan tetap nyaman dilihat berjam-jam:

1. **Hierarki Permukaan 3 Lapis:**
   - **Lapisan 1 (Canvas):** `#f6f8ff` (`dark:bg-slate-950` atau `dark:bg-brand-950`).
   - **Lapisan 2 (Kartu Utama):** `bg-white border border-slate-200/90 rounded-2xl shadow-coffee-sm` (`dark:bg-slate-900 dark:border-slate-800`). Untuk kartu yang dapat diklik, tambahkan `hover:shadow-coffee hover:border-brand-200 transition-all`.
   - **Lapisan 3 (Sub-blok / Inset):** Header tabel, toolbar filter, kotak ringkasan di dalam kartu, atau rincian baris pakai `bg-slate-50/90 border border-slate-200/80 rounded-xl` atau `bg-brand-50/40 border-brand-200/60` (`dark:bg-slate-800/70 dark:border-slate-700/70`).
2. **Kartu KPI Soft-Tinted (Jangan Semua Putih Polos):**
   - Gunakan sapuan gradasi sangat halus + border semantik lembut sesuai makna metrik:
     - Utama/Likuiditas: `bg-gradient-to-br from-brand-50/60 via-white to-white border-brand-200/70`
     - Pemasukan/Profit: `bg-gradient-to-br from-emerald-50/60 via-white to-white border-emerald-200/70`
     - Pengeluaran/Bahaya: `bg-gradient-to-br from-rose-50/60 via-white to-white border-rose-200/70`
     - Pending/Peringatan: `bg-gradient-to-br from-amber-50/60 via-white to-white border-amber-200/70`
     - Info/Benchmark: `bg-gradient-to-br from-sky-50/60 via-white to-white border-sky-200/70`
   - Maksimal **1 kartu hero `.bg-brand-gradient`** per halaman agar tetap bernapas (seperti banner sambutan Dashboard).
3. **Aksi Utama & Kartu Aktif Memakai `brand-600` (Hindari Hitam Kaku `slate-900`):**
   - Tombol CTA utama (`+ Tambah`, `Simpan`, `Bayar`) wajib memakai `bg-brand-600 hover:bg-brand-700 text-white shadow-sm shadow-brand-600/20` (bukan `bg-slate-900`).
   - Kartu pemilih aktif (seperti kartu Pos Kas aktif / metode aktif) memakai aksen `brand-600` atau `.bg-brand-gradient text-white border-brand-600 shadow-coffee`.

---

## 4. Kesiapan Mode Gelap (Dark Mode) & Adaptasi Tema KDS/POS
- **Default:** Light Mode (`#f6f8ff` + kartu putih).
- **KDS & POS Login:** Mengikuti tema aktif aplikasi — tampil bersih terang di Light Mode dan harmonis gelap di Dark Mode (tanpa kontras nabrak).
- **Aturan Pairing Dark Mode:**
  - Setiap token terang pada komponen/fitur baru dipasangkan token gelap yang jelas terbaca (`≥ 4.5:1`):
    - Canvas: `bg-[#f6f8ff] dark:bg-slate-950` (atau `dark:bg-brand-950`)
    - Kartu: `bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800`
    - Inset / Header tabel: `bg-slate-50/90 dark:bg-slate-800/70`
    - Teks judul/isi/muted: `text-slate-900 dark:text-slate-100`, `text-slate-600 dark:text-slate-300`, `text-slate-500 dark:text-slate-400`
    - Teks aksen brand: `text-brand-600 dark:text-brand-300` (**jangan** memakai `brand-600` di atas latar gelap karena kontrasnya jatuh).
    - Tint kartu/badge semantik di dark mode: `dark:bg-{c}-500/15 dark:text-{c}-300 dark:border-{c}-500/30`.

---

## 5. Komponen Umum Wajib (Dilarang Elemen Native Polos)
Saat membuat atau memperbarui modul/fitur baru, **wajib** memakai komponen bersama di `src/components/common/`:

| Kebutuhan | Komponen Wajib | Yang Dilarang |
|---|---|---|
| **Dropdown / Select** | `CustomSelect` (`src/components/common/CustomSelect.tsx`) — portal `z-[9999]`, auto-flip, pencarian optional | `<select>`, `<optgroup>` HTML bawaan |
| **Pilih Tanggal** | `CustomDatePicker` (`src/components/common/CustomDatePicker.tsx`) — format `YYYY-MM-DD`, portal `z-[9999]` | `<input type="date">` bawaan browser |
| **Pilih Bulan / Periode** | `CustomMonthPicker` (`src/components/common/CustomMonthPicker.tsx`) — mendukung `value` `"YYYY-MM"` atau `month`/`year` | `<input type="month">` bawaan browser |
| **Konfirmasi Penting** | `ConfirmModal` (`src/components/common/ConfirmModal.tsx`) — varian `danger` / `warning` / `info` + opsi `verifyKeyword` | `window.confirm()` / `confirm()` bawaan browser |
| **Notifikasi Ringan** | **Toast animasi `motion/react`** (`createPortal(..., document.body)`, auto-tutup 3–4 detik) atau banner inline beranimasi | `window.alert()` / `alert()` bawaan browser (wajib dihindari di semua fitur/modul baru) |
| **Impor / Ekspor CSV/XLSX** | `CsvImportExport` & `GenericImportModal` | Modal tabel impor buatan sendiri dari nol |
| **Format Uang** | `formatCurrency()` (`src/utils/format.ts`) + `tabular-nums` + `RupiahSign` | Format angka float / desimal Rupiah |

Detail resep siap pakai tersedia di `.agents/skills/julias-brand-design/references/components.md`.

---

## 6. Standar Animasi (`motion/react`)
Seluruh animasi memakai paket `motion` (`import { motion, AnimatePresence } from "motion/react"`):
1. **Dilarang `framer-motion`:** Seluruh file `.tsx` wajib import dari `"motion/react"`.
2. **Modal (`fixed inset-0`):**
   - Backdrop: `<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18, ease: "easeOut" }} className="fixed inset-0 ...">`
   - Dialog card: `<motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 8 }} transition={{ type: "spring", damping: 28, stiffness: 360 }} ...>`
3. **Aturan `AnimatePresence` & Portal:**
   - Untuk modal berbasis `createPortal(..., document.body)`, `<AnimatePresence>` **harus berada di dalam `createPortal`** agar animasi `exit` berjalan saat menutup.
   - Untuk modal mandiri tanpa prop `isOpen`, komponen induk wajib membungkus mounting kondisionalnya dengan `<AnimatePresence>...</AnimatePresence>`.
4. **Halaman, Dropdown, Collapsible & Toast:**
   - Entrance halaman/tab: `initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: "easeOut" }}`.
   - Dropdown, panel buka-tutup, alert inline, dan toast wajib memakai `<AnimatePresence>` + `motion.div`.
   - **Hapus** kelas CSS animasi yang bentrok (`animate-in`, `animate-fade-in`, `animate-scale-up`) pada elemen yang sudah dikontrol `motion`.
5. **Grid Dinamis (mis. Kartu KDS):** Gunakan `<AnimatePresence mode="popLayout">` dan `<motion.div layout ...>`.
6. **Kenyamanan POS & Aksesibilitas:** Hormati `prefers-reduced-motion`, jaga durasi cepat (150–250 ms), tanpa animasi dekoratif berulang atau pantulan berlebih di layar kasir.

---

## 7. Logo, Tipografi, Bentuk & Tata Bahasa

### Logo (`public/` & salinan `assets/logos/`)
| File | Pemakaian | Latar |
|---|---|---|
| `logo-name-white.png` | Sidebar / header ukuran kecil ("Julia's") | Brand / gelap |
| `logo-name-blue.png` | Login, header terang | Putih / terang |
| `logo-wordmark-white.png` / `-blue.png` | Cover, splash, materi besar (**dengan tagline**, tinggi ≥ 64 px) | Gelap · terang |
| `logo-icon-color.png` | Ikon di atas biru (sidebar diciutkan, splash) | `brand-600` / gelap |
| `logo-icon-blue.png` | Ikon di atas putih | Terang |
| `favicon.png`, `icon-192/512.png`, `apple-touch-icon.png` | PWA & favicon | — |

Aturan logo: Jangan mengetik ulang kata "Julia's" dengan font; gunakan gambar logo. Prioritaskan `settings.logoDataUrl` bila klien mengunggah logo khusus (logo bawaan sebagai fallback). Jangan memutar, meregangkan, atau memberi outline. Nama brand dari `settings.brandName` (fallback `"Julia's"`).

### Tipografi & Bentuk
- Font: **Plus Jakarta Sans** (`html { font-size: 14px }`).
- Skala: judul halaman `text-base sm:text-lg font-bold tracking-tight`, judul kartu `text-sm font-bold`, label atas/kecil `text-[10px] font-bold uppercase tracking-wider`.
- Radius: input & tombol `rounded-xl`, kartu `rounded-2xl`, modal & hero `rounded-3xl`, badge `rounded-full` atau `rounded-lg`.
- Jarak & bayangan: kelipatan 4 px (`p-4`/`p-5`, `gap-4`), gunakan `.shadow-coffee-sm`, `.shadow-coffee`, `.shadow-coffee-lg` (pertahankan nama utilitas CSS ini).
- Bahasa UI: Indonesia sehari-hari yang ringkas (*"Stok tidak cukup untuk Latte"*). Tagline resmi: **"Specialty Room • Coffee • Eatery"**.
- Struk & cetak thermal: monokrom (hitam-putih) untuk ESC/POS 58mm/80mm; logo biru hanya untuk dokumen/PDF berwarna.

---

## 8. Daftar Periksa Sebelum Menyelesaikan Fitur UI
- [ ] Seluruh warna memakai `brand-*`, `slate-*`, dan semantik + ikon/teks (siap light & dark mode, kontras ≥ 4.5:1)
- [ ] Permukaan berlapis anti-flat (canvas `#f6f8ff` -> kartu putih + shadow halus -> sub-blok `slate-50/90` atau soft-tint; CTA primary `brand-600`)
- [ ] Tidak ada `<select>`, `<input type="date|month">`, `framer-motion`, `window.alert()`, atau `window.confirm()`
- [ ] Semua modal, dropdown, toast, dan panel buka-tutup memakai `motion/react` + `AnimatePresence` (portal `z-[9999]` untuk popover/dropdown agar tidak terpotong `overflow-hidden`)
- [ ] Halaman data memiliki state Loading, Empty, Error, dan Success (Toast animasi)
- [ ] Target sentuh ≥ 48 px di POS/KDS; angka Rupiah bulat + `tabular-nums`
- [ ] Lolos audit statis PowerShell + `npm run lint && npm test && npm run build`
