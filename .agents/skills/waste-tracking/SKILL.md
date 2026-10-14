---
name: waste-tracking
description: "Pencatatan bahan atau produk terbuang (rusak, kedaluwarsa, salah buat) beserta alasan. Gunakan skill ini saat membuat fitur waste, buangan, tumpah, atau analisis kerugian bahan."
---

# Waste Tracking

## Aturan
- Waste dicatat sebagai StockMovement tipe WASTE dengan alasan terstandar (KEDALUWARSA, RUSAK, SALAH_BUAT, TUMPAH, LAINNYA) dan catatan opsional.
- Nilai kerugian = jumlah x biaya per satuan saat kejadian; simpan snapshot.
- Antarmuka cepat: pilih bahan, jumlah, alasan, selesai (barista sering melakukannya sambil sibuk).
- Laporan: waste per bahan, per alasan, per periode, persentase terhadap pemakaian.
- Peringatan pola tak biasa (waste tinggi berulang) sebagai informasi, bukan tuduhan.
