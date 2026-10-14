---
name: ui-design-system
description: "Sistem desain visual (warna, tipografi, komponen, layout, aksesibilitas, mode gelap) berbasis Tailwind dan shadcn/ui. Gunakan skill ini setiap kali membuat atau mengubah tampilan apa pun: halaman, komponen, form, tabel, dashboard, warna, atau layout, meskipun pengguna hanya menyebut \"bagus\", \"rapi\", atau \"ubah tampilan\"."
---

# UI Design System

Token warna ada di `references/globals.css` (salin ke `src/app/globals.css`).

## Prinsip
1. Kejelasan di atas dekorasi; satu aksi utama per layar.
2. Konsisten: pakai komponen shadcn/ui dan token CSS; jangan menulis warna hex langsung di komponen.
3. Hirarki jelas, maksimal dua ukuran font per kartu, banyak ruang kosong.
4. Nuansa hangat dan tenang (krem, coffee), satu warna aksen, tanpa gradient ramai.

## Pengguna berbeda, gaya berbeda
- Kasir: tombol besar, kontras tinggi, sedikit teks.
- Barista: terbaca dari jauh, kartu besar.
- Owner/manajer: dashboard bersih, tabel dan grafik rapi.

## Stack
Tailwind + shadcn/ui, lucide-react, react-hook-form + Zod, TanStack Table, Recharts, sonner (toast), font Plus Jakarta Sans via `next/font`.

## Tipografi
Skala: 12 caption, 14 isi, 16 isi POS, 20 judul kartu, 28 judul halaman, 40+ angka total dan nomor order. Angka uang memakai `tabular-nums`.

## Komponen
- Tombol: primary, secondary, ghost, destructive. Satu primary per area.
- Form: label di atas input, error di bawah input (bahasa Indonesia), tombol submit menampilkan loading.
- Tabel: header lengket, angka rata kanan, filter dan pencarian, pagination, empty state.
- Dialog hanya untuk keputusan penting; pilihan cepat pakai sheet atau popover.

## State wajib di setiap halaman data
Loading (skeleton), empty (ikon + penjelasan + tombol aksi), error (pesan + coba lagi), sukses (toast singkat).

## Responsif
POS dan barista: tablet landscape. Dashboard dan pengaturan: desktop, tetap nyaman di ponsel (tabel scroll horizontal, navigasi drawer atau menu bawah).

## Aksesibilitas
Kontras teks minimal 4.5:1, fokus keyboard terlihat, ikon-saja punya aria-label, target sentuh 44-48 px, hormati `prefers-reduced-motion`, animasi 150-250 ms.

## Bahasa antarmuka
Bahasa Indonesia sehari-hari, singkat. Contoh: "Stok tidak cukup untuk Latte".

## Sebelum selesai
- [ ] Benar di mode terang dan gelap
- [ ] Ada loading, empty, error state
- [ ] Bisa dipakai dengan keyboard
- [ ] Tidak ada warna hardcode
- [ ] Cek tampilan di tablet dan ponsel (ambil screenshot di browser jika tersedia)
