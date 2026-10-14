---
name: receipt-printing
description: Pembuatan struk, nota, dan cetak ke printer thermal. Gunakan skill ini setiap kali membuat halaman struk, tampilan nota, atau fitur cetak.
---

# Receipt Printing

- Halaman struk terpisah (`/receipt/[orderId]`) dengan CSS `@media print`, lebar 58mm atau 80mm, font monospace.
- Isi: nama kedai, nomor order, waktu (zona outlet), item + modifier, subtotal, diskon, service, pajak, total, metode bayar, kembalian.
- Mulai dengan `window.print()`; printer thermal bluetooth/USB (ESC/POS) bisa ditambah belakangan.
- Data struk dari snapshot order, bukan harga menu terkini.
