---
name: pos-ui-design
description: Desain antarmuka kasir (POS), layar antrean barista, keranjang, dan pembayaran untuk tablet. Gunakan skill ini setiap kali membuat atau mengubah UI kasir, grid produk, keranjang, sheet modifier, layar bayar, atau tampilan barista.
---

# POS UI Design

## Prinsip
Kasir bekerja cepat, sering berdiri, dengan tablet atau layar sentuh. Utamakan kecepatan dan minim salah tekan.

## Layout (tablet landscape)
- Kiri (~65%): tab kategori di atas, grid produk di bawah. Kategori "Favorit" di depan.
- Kanan (~35%): keranjang, subtotal, pajak, total, tombol Bayar besar menempel di bawah.
- Pencarian produk di atas.

## Komponen
1. Target sentuh minimal 48x48 px; tombol utama minimal 56 px tinggi.
2. Kartu produk: nama dan harga; foto hanya jika ada dan tidak memperlambat grid.
3. Variant dan modifier lewat sheet dengan pilihan default sudah terpilih (cukup satu ketukan).
4. Ubah jumlah dengan +/-; hapus item satu ketukan plus undo (toast), bukan dialog konfirmasi.
5. Tunai: tombol nominal cepat (uang pas, 50.000, 100.000) dan kembalian ditampilkan besar.
6. Aksi berisiko (void, refund) dipisah dari alur utama dan meminta PIN manajer.
7. Format Rupiah lewat `lib/money.ts` (Rp 25.000).
8. Setelah bayar sukses: ringkasan singkat, tombol "Cetak struk" dan "Order baru" (fokus kembali ke grid produk).

## Status dan keandalan
- Tampilkan status: menyimpan, berhasil, gagal. Tombol Bayar nonaktif saat proses berjalan.
- Pesan error singkat, bahasa Indonesia, memberi solusi.
- Keranjang disimpan di state lokal agar tidak hilang saat refresh.
- Saat offline tampilkan indikator; jangan menampilkan "berhasil" palsu.
- Jangan hanya mengandalkan warna untuk status; tambahkan ikon atau teks.

## Layar barista
Kartu per order berurutan waktu, nomor order besar, modifier ditebalkan, satu tombol pindah status (PREPARING -> READY). Warna dan ikon berubah jika menunggu terlalu lama (mis. > 5 menit). Perbarui otomatis (polling atau SSE). Bunyi order baru bisa dimatikan.

## Implementasi Next.js
Halaman POS: Server Component untuk memuat menu; Client Component hanya untuk keranjang dan interaksi. State keranjang di satu store kecil (Zustand atau useReducer), total memakai fungsi murni dari skill order-flow.
