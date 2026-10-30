import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import fs from "fs";
import path from "path";

// Bulletproof jsPDF Constructor
const JsPDFConstructor: any =
  typeof jsPDF === "function" ? jsPDF : (jsPDF as any)?.default || jsPDF;

const doc = new JsPDFConstructor("p", "mm", "a4");
const pageWidth = doc.internal.pageSize.getWidth();
const pageHeight = doc.internal.pageSize.getHeight();
const margin = 14;
const contentWidth = pageWidth - margin * 2;

// ── COLOR PALETTE ──
const BRAND_NAVY = [15, 23, 42];     // slate-900
const BRAND_AMBER = [245, 158, 11];  // amber-500
const ACCENT_BLUE = [30, 58, 138];   // blue-900
const TEXT_MUTED = [100, 116, 139];  // slate-500
const BG_LIGHT = [248, 250, 252];    // slate-50

// Helper to draw clean section titles
const drawSectionHeader = (y: number, title: string, subtitle?: string) => {
  doc.setFillColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2]);
  doc.rect(margin, y, contentWidth, 8, "F");
  doc.setFillColor(BRAND_AMBER[0], BRAND_AMBER[1], BRAND_AMBER[2]);
  doc.rect(margin, y, 2.5, 8, "F");

  doc.setFontSize(9.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(title.toUpperCase(), margin + 6, y + 5.5);

  if (subtitle) {
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
    doc.text(subtitle, margin, y + 12);
    return y + 15;
  }
  return y + 11;
};

// ============================================================================
// PAGE 1: COVER & EXECUTIVE SUMMARY
// ============================================================================

// Header Cover Banner
doc.setFillColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2]);
doc.rect(0, 0, pageWidth, 55, "F");
doc.setFillColor(BRAND_AMBER[0], BRAND_AMBER[1], BRAND_AMBER[2]);
doc.rect(0, 53.5, pageWidth, 1.5, "F");

doc.setFontSize(18);
doc.setFont("helvetica", "bold");
doc.setTextColor(255, 255, 255);
doc.text("JULIA'S COFFEE & EATERY", margin, 20);

doc.setFontSize(10.5);
doc.setFont("helvetica", "normal");
doc.setTextColor(BRAND_AMBER[0], BRAND_AMBER[1], BRAND_AMBER[2]);
doc.text("BUKU PANDUAN RESMI SISTEM, ROLE & OPERASIONAL KEDAI", margin, 28);

doc.setFontSize(8);
doc.setTextColor(203, 213, 225);
doc.text("Specialty Room • Coffee • Eatery | Integrated POS & ERP Platform", margin, 35);
doc.text("Versi Sistem: 2.4.0 (Production Ready)  •  Edisi: November 2026", margin, 40);

let curY = 62;

// Overview Text Box
doc.setFillColor(BG_LIGHT[0], BG_LIGHT[1], BG_LIGHT[2]);
doc.setDrawColor(226, 232, 240);
doc.roundedRect(margin, curY, contentWidth, 22, 2, 2, "FD");

doc.setFontSize(8.5);
doc.setFont("helvetica", "bold");
doc.setTextColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2]);
doc.text("TUJUAN DOKUMEN:", margin + 4, curY + 6);

doc.setFontSize(7.8);
doc.setFont("helvetica", "normal");
doc.setTextColor(71, 85, 105);
const overviewText =
  "Buku panduan ini disusun sebagai standar operasional prosedur (SOP) digital untuk seluruh staf Julia's Coffee " +
  "(Owner, Manager, Kasir, Leader Bar, Kitchen, Pastry, dan Finance). Berisi petunjuk langkah demi langkah, " +
  "matriks hak akses, serta flowchart alur kerja mulai dari buka kasir hingga tutup buku harian.";
doc.text(doc.splitTextToSize(overviewText, contentWidth - 8), margin + 4, curY + 11);

curY += 28;

// SECTION 1: MATRIKS ROLE & HAK AKSES PENGGUNA
curY = drawSectionHeader(curY, "1. Matriks 9 Role & Akun Pengguna Uji Coba", "Daftar kredensial awal untuk uji coba operasional kedai (Default PIN: 123456)");

autoTable(doc, {
  startY: curY,
  head: [["Role / Peran", "Username", "PIN", "Nama Tampilan", "Wewenang & Cakupan Akses"]],
  body: [
    ["SUPER_ADMIN", "admin", "123456", "Super Admin", "Akses 100% penuh tanpa batas ke seluruh modul sistem."],
    ["OWNER", "owner", "123456", "Owner Julia's", "Dashboard Laba-Rugi, Omzet, Payroll, Audit Log (Mode Pengawasan)."],
    ["MANAGER", "manager", "123456", "Manager Operasional", "Otorisasi PIN Void/Refund, Kelola Stok, Pembelian PO, Jadwal & HR."],
    ["KASIR", "kasir", "123456", "Terminal Kasir POS", "Buka/Tutup Shift, Transaksi Meja, Split Bill, Cetak Thermal & Struk WA."],
    ["LEADER", "leader", "123456", "Rama (Leader Bar)", "Checklist Bar, Presensi Tim, Mutasi Bahan, Stok Opname, Resep Menu."],
    ["BAR", "barista", "123456", "Budi (Barista)", "Layar KDS Minuman, Ubah Status Pesanan, Presensi Masuk/Pulang GPS."],
    ["KITCHEN", "kitchen", "123456", "Chef Dapur", "Layar KDS Makanan, Stok Bahan Dapur, Catat Waste Masakan Rusak."],
    ["BAKER", "baker", "123456", "Pastry Baker", "Layar KDS Pastry/Bakery, Stok Adonan Butter, Batch Baking."],
    ["FINANCE", "finance", "123456", "Finance & Accounting", "Buku Kas, Petty Cash, Pembayaran Biaya, Rekonsiliasi Bank, Payroll."],
  ],
  theme: "grid",
  headStyles: {
    fillColor: [30, 41, 59],
    textColor: [255, 255, 255],
    fontStyle: "bold",
    fontSize: 7.5,
  },
  bodyStyles: {
    fontSize: 7,
    textColor: [30, 41, 59],
    cellPadding: 1.8,
  },
  columnStyles: {
    0: { cellWidth: 26, fontStyle: "bold" },
    1: { cellWidth: 20, fontStyle: "bold", textColor: [30, 58, 138] },
    2: { cellWidth: 16, halign: "center", fontStyle: "bold" },
    3: { cellWidth: 32 },
    4: { cellWidth: 88, textColor: [71, 85, 105] },
  },
  margin: { left: margin, right: margin },
});

curY = (doc as any).lastAutoTable.finalY + 8;

// SECTION 2: WORKFLOW UTAMA (FLOWCHART LOGIC)
curY = drawSectionHeader(curY, "2. Alur Kerja Harian Kedai (Daily Operational Flow)");

autoTable(doc, {
  startY: curY,
  head: [["Fase Waktu", "Pelaksana", "Aksi Operasional di Aplikasi", "Output / Hasil Sistem"]],
  body: [
    [
      "07:30 WITA\n(Pembukaan)",
      "Kasir & Leader Bar",
      "1. Presensi masuk Clock-In dengan foto & GPS.\n2. Buka Menu POS -> Klik 'Buka Shift Kasir'.\n3. Masukkan Modal Awal (misal: Rp 300.000).\n4. Isi Checklist Kebersihan Bar & Kalibrasi Mesin.",
      "• Shift Kasir Aktif\n• Laci Kasir Terbuka\n• Resep Siap Jual\n• Bahan Terkalibrasi"
    ],
    [
      "08:00 - 22:00\n(Pelayanan Kasir)",
      "Kasir POS &\nBarista / Kitchen",
      "1. Pilih Tipe: Dine In (Meja) atau Take Away.\n2. Sentuh menu kopi / makanan + modifier.\n3. Masukkan diskon promo jika ada.\n4. Pilih Pembayaran (CASH / QRIS / DEBIT).\n5. Cetak struk printer thermal 80mm & WA.",
      "• Tiket muncul di KDS Bar & Kitchen\n• Stok bahan berkurang otomatis\n• Poin loyalitas WA terbit\n• Uang kas masuk tercatat"
    ],
    [
      "22:30 WITA\n(Penutupan Toko)",
      "Kasir & Manager",
      "1. Klik tombol 'Tutup Shift' di POS.\n2. Hitung fisik uang di laci kasir.\n3. Input angka uang riil -> Sistem hitung selisih.\n4. Cetak Slip Z-Report & kunci terminal POS.",
      "• Transaksi hari itu terkunci\n• Rekap kas lunas / selisih tercatat\n• Audit log shift tersimpan"
    ],
    [
      "Mingguan / Akhir Bulan",
      "Manager, Leader &\nOwner",
      "1. Audit Stok Opname (Timbang fisik bahan baku).\n2. Cek Laporan Eksekutif Master & Profit Laba-Rugi.\n3. Setujui Payroll gaji karyawan & cetak slip.",
      "• Saldo stok riil terbarui\n• Kerugian HPP tercatat\n• Dokumen resmi PDF terbit"
    ]
  ],
  theme: "grid",
  headStyles: {
    fillColor: [30, 58, 138],
    textColor: [255, 255, 255],
    fontStyle: "bold",
    fontSize: 7.5,
  },
  bodyStyles: {
    fontSize: 7,
    textColor: [30, 41, 59],
    cellPadding: 2,
  },
  columnStyles: {
    0: { cellWidth: 26, fontStyle: "bold" },
    1: { cellWidth: 28, fontStyle: "bold" },
    2: { cellWidth: 80 },
    3: { cellWidth: 48, textColor: [4, 120, 87] },
  },
  margin: { left: margin, right: margin },
});

// Footer Page 1
doc.setFontSize(7);
doc.setFont("helvetica", "normal");
doc.setTextColor(148, 163, 184);
doc.text("Halaman 1 dari 2  •  Buku Panduan Sistem Julia's Coffee & Eatery  •  Kerahasiaan Internal Kedai", pageWidth / 2, pageHeight - 6, { align: "center" });

// ============================================================================
// PAGE 2: STEP-BY-STEP SOP & KEAMANAN
// ============================================================================
doc.addPage();

// Mini Header Page 2
doc.setFillColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2]);
doc.rect(0, 0, pageWidth, 16, "F");
doc.setFillColor(BRAND_AMBER[0], BRAND_AMBER[1], BRAND_AMBER[2]);
doc.rect(0, 15, pageWidth, 1, "F");

doc.setFontSize(9);
doc.setFont("helvetica", "bold");
doc.setTextColor(255, 255, 255);
doc.text("PANDUAN OPERASIONAL TEKNIS & PETUNJUK KASIR / DAPUR", margin, 10.5);

doc.setFontSize(7.5);
doc.setFont("helvetica", "normal");
doc.setTextColor(BRAND_AMBER[0], BRAND_AMBER[1], BRAND_AMBER[2]);
doc.text("Julia's Management System  •  SOP Pelaksanaan", pageWidth - margin, 10.5, { align: "right" });

curY = 24;

// SECTION 3: PANDUAN LANGKAH DEMI LANGKAH KASIR
curY = drawSectionHeader(curY, "3. Panduan Fitur Kasir POS & Kitchen Display (KDS)");

autoTable(doc, {
  startY: curY,
  head: [["Skenario / Kasus", "Langkah Penyelesaian di POS", "Catatan Penting Keamanan"]],
  body: [
    [
      "Pelanggan Pesan Makan Sini (Dine In) & Minta Tambah Menu Nanti",
      "1. Pilih tab 'Dine In' -> Ketik Nomor Meja (misal: Meja 05).\n2. Masukkan menu pesanan pertama -> Klik 'Simpan Bill Meja'.\n3. Saat tamu pesan lagi, buka 'Open Bill' -> pilih Meja 05 -> tambah item.",
      "Pesanan langsung terkirim ke KDS Barista & Dapur meski belum dibayar."
    ],
    [
      "Split Bill (Pecah Tagihan Satu Meja Menjadi 2 Pembayaran)",
      "1. Buka pesanan aktif meja di POS -> Klik tombol 'Split Bill'.\n2. Pilih mode: 'Pecah Menu' (pilih item tertentu) atau 'Bagi Rata' (Evenly).\n3. Bayar tagihan pertama (misal: QRIS). Sisa tagihan tetap tersimpan di meja.",
      "Total pembayaran split dijamin akurat tanpa selisih desimal Rp."
    ],
    [
      "Pembatalan Transaksi / Salah Input (Void Pesanan)",
      "1. Klik tombol 'Riwayat & Refund' -> Pilih nomor nota pesanan.\n2. Klik 'Void Pesanan'. Layar meminta PIN Supervisor.\n3. Manager memasukkan PIN (123456) dan alasan pembatalan.",
      "Wajib otorisasi Supervisor PIN. Bahan baku otomatis dikembalikan ke stok gudang."
    ],
    [
      "Koneksi Internet / Wi-Fi Kedai Terputus (Mode Offline)",
      "1. Kasir tetap membuka aplikasi seperti biasa (didukung PWA Cache).\n2. Terima pembayaran TUNAI (CASH) -> Struk tetap terbit.\n3. Begitu Wi-Fi kembali, klik 'Sync Order' di pojok atas.",
      "Pembayaran non-tunai (QRIS) memerlukan internet. Pakai tunai saat offline."
    ]
  ],
  theme: "grid",
  headStyles: {
    fillColor: [30, 41, 59],
    textColor: [255, 255, 255],
    fontStyle: "bold",
    fontSize: 7.5,
  },
  bodyStyles: {
    fontSize: 7,
    textColor: [30, 41, 59],
    cellPadding: 2,
  },
  columnStyles: {
    0: { cellWidth: 42, fontStyle: "bold" },
    1: { cellWidth: 84 },
    2: { cellWidth: 56, textColor: [180, 83, 9] },
  },
  margin: { left: margin, right: margin },
});

curY = (doc as any).lastAutoTable.finalY + 8;

// SECTION 4: INVENTARIS, RESEP & STOK OPNAME
curY = drawSectionHeader(curY, "4. Panduan Resep, Bahan Baku & Audit Stok Opname");

autoTable(doc, {
  startY: curY,
  head: [["Modul Inventori", "Fungsi & Prosedur", "Rumus & Dampak Finansial"]],
  body: [
    [
      "Resep & Deduksi Otomatis",
      "Setiap porsi kopi memotong takaran bahan di gudang (contoh: Kopi Susu Aren memotong 18g espresso beans, 120ml milk, 25ml aren, 120g es batu).",
      "Stok riil terpantau tanpa perlu input manual setiap cup terjual."
    ],
    [
      "Kalibrasi & Waste Barista",
      "Barista mencatat tumpahan kopi (*spill*) atau espresso dial-in pagi hari langsung via tombol 'Kalibrasi & Waste' di POS.",
      "Sistem mencatat nilai kerugian HPP (Rupiah Loss) secara transparan."
    ],
    [
      "Stok Opname Mingguan",
      "1. Buka Menu Inventori -> Tab 'Stok Opname'.\n2. Klik 'Mulai Sesi Opname'. Input jumlah fisik yang ditimbang di bar.\n3. Sistem menghitung selisih (Fisik - Sistem) & estimasi defisit HPP.\n4. Klik 'Finalisasi & Sesuaikan Stok' untuk mengoreksi kartu stok.",
      "Selisih = Fisik - Sistem.\nDefisit HPP = Selisih Minus x Harga Modal Beli Bahan."
    ]
  ],
  theme: "grid",
  headStyles: {
    fillColor: [15, 118, 110],
    textColor: [255, 255, 255],
    fontStyle: "bold",
    fontSize: 7.5,
  },
  bodyStyles: {
    fontSize: 7,
    textColor: [30, 41, 59],
    cellPadding: 2,
  },
  columnStyles: {
    0: { cellWidth: 40, fontStyle: "bold" },
    1: { cellWidth: 86 },
    2: { cellWidth: 56, textColor: [30, 58, 138] },
  },
  margin: { left: margin, right: margin },
});

curY = (doc as any).lastAutoTable.finalY + 8;

// SECTION 5: PETUNJUK AKSES & PENTING
doc.setFillColor(254, 243, 199); // amber-100
doc.setDrawColor(245, 158, 11); // amber-500
doc.roundedRect(margin, curY, contentWidth, 24, 2, 2, "FD");

doc.setFontSize(8.5);
doc.setFont("helvetica", "bold");
doc.setTextColor(146, 64, 14); // amber-900
doc.text("CATATAN PENTING UNTUK MANAJEMEN & TIM KASIR:", margin + 4, curY + 6);

doc.setFontSize(7.5);
doc.setFont("helvetica", "normal");
doc.setTextColor(120, 53, 15);
const noteLines = [
  "1. URL Akses Utama Sistem: https://juliacoffeemanagement.up.railway.app",
  "2. Terminal POS Kasir dapat diakses langsung melalui: https://juliacoffeemanagement.up.railway.app/pos",
  "3. Layar Antrean Dapur & Bar (KDS): https://juliacoffeemanagement.up.railway.app/kds",
  "4. Seluruh user uji coba memiliki PIN awal: 123456 (Dapat diubah di menu Pengaturan Pengguna).",
  "5. Saat sesi uji coba awal bulan selesai, manajemen dapat mereset data transaksi kembali bersih 100%."
];
noteLines.forEach((line, idx) => {
  doc.text(line, margin + 4, curY + 11 + idx * 3.8);
});

// Footer Page 2
doc.setFontSize(7);
doc.setFont("helvetica", "normal");
doc.setTextColor(148, 163, 184);
doc.text("Halaman 2 dari 2  •  Buku Panduan Sistem Julia's Coffee & Eatery  •  Dokumen Sah Manajemen", pageWidth / 2, pageHeight - 6, { align: "center" });

// Output & Save to public directory
const outputPath = path.join(process.cwd(), "public", "Buku_Panduan_Resmi_Julia_Coffee.pdf");
const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
fs.writeFileSync(outputPath, pdfBuffer);
console.log(`PDF berhasil dibuat: ${outputPath} (${pdfBuffer.length} bytes)`);
