---
name: julias-brand-design
description: "Identitas visual dan aturan UI/UX Julia's Specialty Room • Coffee • Eatery: palet biru brand #1b2cc0, pemakaian logo, tipografi, bentuk, komponen Tailwind, dan pola layar (sidebar, login, dashboard, POS, KDS, struk, PWA). Gunakan skill ini SETIAP KALI membuat atau mengubah tampilan apa pun: halaman, komponen, warna, ikon, grafik, badge status, modal, tabel, form, login, sidebar, struk, favicon, atau saat memasang logo, bahkan jika pengguna tidak menyebut 'brand' atau 'desain'. Untuk urusan warna dan nuansa, skill ini MENGGANTIKAN ui-design-system (yang masih bernuansa cokelat/krem)."
---

# Julia's Brand Design

Klien: **Julia's** — tagline resmi **"Specialty Room • Coffee • Eatery"**.
Kesan visual: modern, berani, bersih, ramah. Bentuk membulat (meniru ikon rumah dengan bintang empat sudut). **Bukan** tema kopi cokelat/krem.

## Prioritas dan konteks stack
- Untuk **warna, nuansa, logo, tipografi brand**: skill ini menang atas skill lain (`ui-design-system`, `pos-ui-design`).
- Untuk **alur dan perilaku** (tabel, form, POS, KDS, aksesibilitas, state loading/empty/error): tetap ikuti skill terkait.
- Stack nyata repo ini: **React 19 + Vite + Tailwind v4**, `lucide-react`, `recharts`, `motion`. Bukan Next.js dan tidak memakai shadcn (tidak ada `src/components/ui`). Abaikan instruksi `next/font`, Server Component, dan `src/app/globals.css` dari skill lain.
- **Sumber kebenaran token:** blok `@theme` di `src/index.css`. Snapshot ada di `references/tokens.css`. Jika keduanya berbeda, `src/index.css` yang benar.

## Palet

| Token Tailwind | Hex | Pakai untuk |
|---|---|---|
| `brand-600` | `#1b2cc0` | **Warna brand utama** (dari logo): tombol primary, link, item aktif, header |
| `brand-700` / `800` | `#1624a0` / `#121d80` | hover/active tombol, teks aksen di atas `brand-50/100` |
| `brand-900` / `950` | `#0f1860` / `#0a1040` | permukaan gelap (KDS, kartu ringkasan gelap), teks judul beraksen |
| `brand-500` | `#4a5ff0` | focus ring, grafik sekunder, hover ringan |
| `brand-400` | `#7692ff` | gradasi ikon logo; dekoratif dan ikon besar saja |
| `brand-300` / `sky` | `#a8bcff` / `#a2c5fb` | teks/ikon di atas latar gelap, gradasi |
| `brand-50` / `100` / `200` | `#eef2ff` / `#dfe6ff` / `#c3cfff` | latar item aktif, badge lembut, border aksen |
| `slate-*` | — | **semua netral**: teks, border, latar |
| latar halaman | `#f6f8ff` | `body` (sudah diatur di `index.css`) |

**Warna semantik (status), terpisah dari brand:** sukses `emerald-600/700`, peringatan `amber-500..700`, bahaya `rose-600/700`, info `sky-600`.
Biru brand berarti **aksi dan identitas**, bukan status. Status selalu memakai warna semantik **plus ikon atau teks**.

Komposisi layar: ±70% netral (putih/slate), ±20% brand, ±10% semantik.

## Aturan warna (wajib)
1. Aksen = `brand-*`. Dilarang memakai `amber`, `orange`, `stone`, `yellow`, `indigo`, `blue` sebagai warna aksen atau identitas. `amber` **hanya** untuk peringatan (stok menipis, telat, menunggu, periode terkunci). Satu-satunya pengecualian adalah **palet lencana peran** di bawah.
2. Netral = `slate-*`. Jangan `stone`, `gray`, `zinc`, `neutral`.
3. Jangan menulis hex di komponen. Satu-satunya pengecualian: warna di props Recharts (tidak bisa kelas Tailwind), pakai urutan ini:
   `["#1b2cc0", "#7692ff", "#0f1860", "#a2c5fb", "#059669", "#e11d48"]`
4. Kontras (dihitung): putih di atas `brand-600` **9.7:1**; `brand-600` di atas putih **9.7:1**; `brand-500` di atas putih 5.0:1; `#a2c5fb` di atas `brand-600` 5.5:1; `brand-400` di atas putih hanya **2.9:1**.
   Maka: teks kecil di latar terang minimal `brand-600`; `brand-400` jangan untuk teks; di atas `brand-600` pakai putih atau `brand-sky`.
5. Teks utama `slate-900`, sekunder `slate-600`; teks penting jangan lebih terang dari `slate-500`.
6. Gradasi `bg-brand-gradient` (di `index.css`) hanya untuk: header sidebar, **satu** kartu hero per halaman, atau CTA besar. Selebihnya warna solid.
7. Warna tidak boleh menjadi satu-satunya pembeda (tambahkan ikon/teks/pola), terutama di grafik dan status.

## Palet lencana peran (pengecualian resmi)
Warna ini identitas peran pengguna, bukan aksen brand. Dipisah jelas dari biru brand agar tidak tertukar:
Owner = `brand` · Manager = `violet` · Finance = `sky` · Kasir = `emerald` · Leader = `orange` · Staff = `slate`.
Pola terang (Login, tabel): `text-{c}-800 bg-{c}-50 border-{c}-200`. Pola di atas latar gelap (sidebar): `bg-{c}-500/15 text-{c}-300 border-{c}-500/30`. Selalu sertakan label teks peran. Terapkan juga di `Users.tsx` dan komponen lain saat file itu disentuh.

## Logo
File ada di `public/` (salinan di `assets/logos/`). Detail lengkap: `references/logo-usage.md`.

| File | Pakai untuk | Latar |
|---|---|---|
| `logo-name-white.png` | sidebar/header ukuran kecil ("Julia's" saja) | brand/gelap |
| `logo-name-blue.png` | login, header terang | putih/terang |
| `logo-wordmark-white.png` / `-blue.png` | cover, splash, materi besar (**dengan tagline**, tinggi ≥ 64 px) | brand/gelap · terang |
| `logo-icon-color.png` | ikon di atas biru (sidebar diciutkan, splash) | `brand-600`/gelap |
| `logo-icon-blue.png` | ikon di atas putih | terang |
| `favicon.png`, `icon-192/512.png`, `apple-touch-icon.png` | PWA/favicon | — |

Aturan: jangan mengetik ulang "Julia's" dengan font; selalu pakai gambar logo. Jangan memutar, meregangkan, memberi bayangan/outline, atau mengubah warnanya. Jika `settings.logoDataUrl` terisi (logo upload klien), itu didahulukan; logo bawaan hanya fallback. Nama dari `settings.brandName`, fallback "Julia's".

## Tipografi
- **Plus Jakarta Sans** (sudah dimuat di `index.html`); dasar `html { font-size: 14px }`.
- Judul halaman `text-base sm:text-lg font-bold tracking-tight`; judul kartu `text-sm font-bold`; label kecil `text-[10px] font-bold uppercase tracking-wider`.
- Angka uang dan KPI memakai `tabular-nums` (sudah otomatis untuk `td`, `th`, `.font-mono`) dan format dari `formatCurrency` di `src/utils/format.ts` ("Rp 25.000").
- Jangan menambah font baru tanpa persetujuan pengguna.

## Bentuk, jarak, elevasi
- Radius: input dan tombol `rounded-xl`; kartu `rounded-2xl`; modal dan hero `rounded-3xl`; badge `rounded-full` atau `rounded-lg`.
- Bayangan: `shadow-coffee-sm`, `shadow-coffee`, `shadow-coffee-lg` (nama lama, tetap dipakai; jangan di-rename).
- Kelipatan 4 px; padding kartu `p-4` atau `p-5`; jarak antar kartu `gap-4`.
- Fokus: sudah global di `index.css`; tambahkan `focus-visible:ring-2 focus-visible:ring-brand-500/30` pada input.

## Pola layar
- **Sidebar:** header `bg-brand-gradient` dengan logo putih (ikon saja saat diciutkan); item aktif `bg-brand-50 text-brand-950 border-l-3 border-brand-600`; tombol di atas band biru memakai `text-white/70 hover:bg-white/10`.
- **Login:** latar `#F8F9FA`/putih, logo biru, satu tombol primary penuh.
- **Dashboard:** baris kartu KPI → grafik → tabel. Maksimal satu kartu hero bergradasi.
- **POS (tablet landscape):** target sentuh ≥ 48 px, tombol Bayar `h-14 bg-brand-600`, kembalian besar. Layout dan alur: skill `pos-ui-design`.
- **KDS:** latar `brand-950`, kartu putih/`slate-50`, nomor order besar; status lewat warna semantik + ikon/teks. Alur: skill `kitchen-display-system`.
- **Struk dan dokumen cetak:** monokrom (hitam-putih) untuk printer thermal; logo versi biru hanya untuk PDF/invoice berwarna. Lihat `references/logo-usage.md`.

## Status pesanan (konsisten di seluruh aplikasi)
Menunggu = amber · Diproses = brand · Siap = emerald · Selesai = slate · Batal/Void = rose · Info = sky. Selalu sertakan label teks.

## Gerak
Pakai `motion` secukupnya: 150–250 ms, ease-out, tanpa efek memantul di POS/KDS. Hormati `prefers-reduced-motion`. Tidak ada animasi dekoratif yang berulang.

## Bahasa antarmuka
Bahasa Indonesia sehari-hari dan singkat ("Stok tidak cukup untuk Latte"). Tagline ditulis apa adanya: "Specialty Room • Coffee • Eatery".

## Alur kerja saat mengubah UI
1. Baca token di `src/index.css`; cari komponen serupa di `src/components/` dan pakai ulang polanya (resep: `references/components.md`).
2. Tulis perubahan hanya dengan token brand/slate/semantik.
3. Jalankan audit untuk file yang kamu ubah: `bash .agents/skills/julias-brand-design/references/audit.sh`
4. Jalankan `npx vite build` (harus sukses). `npx tsc --noEmit` punya error bawaan repo; pastikan jumlahnya tidak bertambah.
5. Jika browser tersedia, cek di 1024×768 (tablet landscape) dan 390×844 (ponsel); ambil screenshot.
6. Jangan migrasi massal file yang tidak kamu sentuh kecuali diminta; file yang kamu ubah harus lolos audit.

## Checklist sebelum selesai
- [ ] Hanya `brand-*`, `slate-*`, dan warna semantik; tidak ada hex di komponen
- [ ] Logo benar (file, latar, ukuran); tidak diketik ulang
- [ ] Kontras teks ≥ 4.5:1; status punya ikon/teks
- [ ] Target sentuh ≥ 48 px di layar POS/KDS
- [ ] Ada state loading, empty, error di halaman data
- [ ] `audit.sh` bersih dan `vite build` sukses
