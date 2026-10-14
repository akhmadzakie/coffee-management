---
name: manager-pin-approval
description: "Persetujuan PIN manajer untuk aksi berisiko (void, refund, diskon besar, buka laci). Gunakan skill ini saat membuat aksi yang perlu otorisasi tambahan di kasir."
---

# Manager Pin Approval

## Aturan
- Aksi berisiko meminta PIN manajer/owner tanpa harus mengganti sesi kasir.
- PIN di-hash (bukan teks biasa), panjang 4-6 digit, dengan pembatasan percobaan dan penguncian sementara.
- Verifikasi di server; hasil menyertakan siapa yang menyetujui.
- Setiap persetujuan masuk audit log: kasir, penyetuju, aksi, alasan, waktu.
- Ambang (mis. diskon di atas X%) configurable per outlet.
- PIN tidak ditampilkan dan tidak dikirim lewat URL.
