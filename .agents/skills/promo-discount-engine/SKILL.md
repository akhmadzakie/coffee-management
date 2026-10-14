---
name: promo-discount-engine
description: "Mesin diskon dan promo (persen, nominal, beli X gratis Y, periode) dengan aturan prioritas. Gunakan skill ini saat menambah promo, diskon item, diskon order, atau saat total belanja terpengaruh potongan harga."
---

# Promo Discount Engine

## Model
Promo punya: tipe (PERCENT, FIXED, BOGO), cakupan (item, kategori, seluruh order), periode, hari/jam berlaku, syarat minimal belanja, batas pemakaian, dan prioritas.
## Aturan
1. Satu fungsi murni `applyPromotions(items, promos)` yang mengembalikan rincian potongan per item dan total; dites tanpa database.
2. Tentukan eksplisit apakah promo boleh digabung (stackable). Default: tidak digabung, ambil yang paling menguntungkan pelanggan.
3. Potongan tidak boleh membuat harga item atau total negatif.
4. Diskon persen dihitung dalam basis points dan dibulatkan ke Rupiah.
5. Simpan promo yang dipakai di order (snapshot nama dan nilai) untuk laporan.
6. Diskon manual di atas batas tertentu butuh persetujuan manajer (skill manager-pin-approval).
7. Hasil masuk ke urutan total di skill order-flow: diskon sebelum service charge dan pajak.
