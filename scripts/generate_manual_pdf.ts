import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as fs from "fs";
import * as path from "path";

async function generateManualPdf() {
  const doc = new jsPDF({
    orientation: "p",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Helper for adding headers and footers on content pages
  const addHeaderFooter = (pageNumber: number, totalPages: number, sectionTitle: string) => {
    // Top banner/line
    doc.setFillColor(30, 58, 138); // Navy blue
    doc.rect(14, 10, pageWidth - 28, 0.8, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(30, 58, 138);
    doc.text("COFFEE MANAGEMENT & POS SYSTEM", 14, 8);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(sectionTitle, pageWidth - 14, 8, { align: "right" });

    // Bottom banner/line
    doc.setFillColor(226, 232, 240);
    doc.rect(14, pageHeight - 14, pageWidth - 28, 0.5, "F");

    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text("Dokumen Resmi untuk Klien & Stakeholder — Confidential & Proprietary", 14, pageHeight - 9);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(`Halaman ${pageNumber} dari ${totalPages}`, pageWidth - 14, pageHeight - 9, { align: "right" });
  };

  // Helper for section title
  const addSectionTitle = (title: string, yPos: number, subtitle?: string) => {
    doc.setFillColor(30, 58, 138);
    doc.roundedRect(14, yPos, 4, 14, 1, 1, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text(title, 22, yPos + 6);

    if (subtitle) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text(subtitle, 22, yPos + 12);
    }
  };

  // ==========================================
  // PAGE 1: COVER PAGE (Executive Design)
  // ==========================================
  // Deep Navy Background
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  // Accent Gradient Shapes / Geometric lines
  doc.setFillColor(30, 58, 138); // blue-900
  doc.rect(0, 0, pageWidth, 110, "F");

  doc.setFillColor(37, 99, 235); // blue-600
  doc.rect(0, 108, pageWidth, 4, "F");

  doc.setFillColor(245, 158, 11); // amber-500
  doc.rect(0, 112, pageWidth, 2, "F");

  // Badge
  doc.setFillColor(245, 158, 11);
  doc.roundedRect(20, 30, 70, 7, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text("EDISI RESMI KLIEN & OPERASIONAL", 24, 34.5);

  // Big Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(255, 255, 255);
  doc.text("COFFEE MANAGEMENT", 20, 55);
  doc.text("& POS SYSTEM", 20, 68);

  // Tagline
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(191, 219, 254); // blue-200
  doc.text("Buku Panduan Pengguna & Standar Operasional Kafe Terpadu", 20, 80);
  doc.setFontSize(9.5);
  doc.setTextColor(147, 197, 253);
  doc.text("Platform All-in-One: Kasir POS, Kitchen Display, Inventori Resep, HR & Finansial", 20, 88);

  // Content Feature Cards on Cover
  const coverFeatures = [
    { title: "Point of Sale (POS)", desc: "Kasir tablet kilat, multi-meja, open bill, split bill, & cetak struk thermal." },
    { title: "Kitchen Display (KDS)", desc: "Tiket pesanan digital tanpa kertas untuk Barista, Dapur, dan Bakery." },
    { title: "Inventori & Resep HPP", desc: "Auto-deduct stok, kalkulasi HPP margin profit, & stok opname presisi." },
    { title: "SDM & Penggajian (Payroll)", desc: "Presensi GPS selfie, checklist SOP harian tim, & slip gaji digital." },
    { title: "Keuangan & Rekonsiliasi Bank", desc: "Arus kas masuk/keluar, buku besar kas kecil, & rekonsiliasi mutasi bank." },
    { title: "Pusat Ekspor Eksekutif", desc: "Laporan Master Excel 7-Sheet & berkas PDF ringkasan eksekutif siap cetak." },
  ];

  let cardY = 135;
  coverFeatures.forEach((feat, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = col === 0 ? 20 : 110;
    const y = cardY + row * 28;

    doc.setFillColor(30, 41, 59); // slate-800
    doc.roundedRect(x, y, 80, 23, 3, 3, "F");

    doc.setFillColor(245, 158, 11);
    doc.circle(x + 5, y + 7, 1.5, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(255, 255, 255);
    doc.text(feat.title, x + 9, y + 8);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    const splitDesc = doc.splitTextToSize(feat.desc, 70);
    doc.text(splitDesc, x + 9, y + 14);
  });

  // Footer on Cover
  doc.setFillColor(30, 41, 59);
  doc.rect(0, pageHeight - 30, pageWidth, 30, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text("Disiapkan untuk: Pemilik Usaha, Klien, Manajer, & Tim Operasional", 20, pageHeight - 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text("Versi Sistem: 2.4.0 Enterprise Edition • Status: Production Ready • Tanggal: 2026", 20, pageHeight - 11);

  // ==========================================
  // PAGE 2: RINGKASAN EKSEKUTIF & DAFTAR ISI
  // ==========================================
  doc.addPage();
  addHeaderFooter(2, 6, "1. RINGKASAN & DAFTAR ISI");

  addSectionTitle("Ringkasan Eksekutif & Nilai Tambah Platform", 18, "Solusi holistik operasional bisnis Food & Beverage modern");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  const execSummary =
    "Aplikasi Coffee Management & POS System adalah ekosistem terpadu yang memadukan kecepatan transaksi kasir di lini depan dengan keandalan pembukuan akuntansi di lini belakang. Dirancang dengan teknologi modern berarsitektur Tri-Portal, sistem ini memisahkan operasional kafe menjadi tiga antarmuka khusus: Portal Manajemen Web (/), Terminal Kasir POS (/pos), dan Kitchen Display System (/kds).";
  const execSummaryLines = doc.splitTextToSize(execSummary, pageWidth - 28);
  doc.text(execSummaryLines, 14, 38);

  // Table of Contents
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 58, 138);
  doc.text("Struktur Modul & Panduan Aplikasi:", 14, 58);

  const tocItems = [
    { no: "BAB 1", title: "Arsitektur Tri-Portal & Rute Akses", desc: "Pemisahan Web Admin, Terminal POS, dan KDS Dapur", page: "Hal. 2" },
    { no: "BAB 2", title: "Matriks Peran Pengguna (Role & Akses)", desc: "Hak otoritas Owner, Manager, Kasir, Barista, & HRD", page: "Hal. 3" },
    { no: "BAB 3", title: "Terminal Kasir POS (/pos) & Setup Printer", desc: "Buka shift, pesanan, open bill, pelunasan, & struk thermal", page: "Hal. 3" },
    { no: "BAB 4", title: "Kitchen Display System (KDS /kds)", desc: "Antrean digital Bar Minuman, Kitchen Dapur, & Bakery", page: "Hal. 4" },
    { no: "BAB 5", title: "Inventori, Resep Produk & HPP Margin", desc: "Pengurangan stok otomatis, PO pemasok, & opname selisih", page: "Hal. 4" },
    { no: "BAB 6", title: "SDM, Presensi GPS Selfie & Payroll", desc: "Clock-in geofencing, checklist leader, & slip gaji resmi", page: "Hal. 5" },
    { no: "BAB 7", title: "Keuangan, Arus Kas & Rekonsiliasi Bank", desc: "Buku kas laci/petty cash, laba rugi, & audit rekening", page: "Hal. 5" },
    { no: "BAB 8", title: "Pusat Ekspor Laporan & SOP Kendala (FAQ)", desc: "Master Excel 7-Sheet, PDF Eksekutif, & panduan offline", page: "Hal. 6" },
  ];

  autoTable(doc, {
    startY: 63,
    head: [["Bab", "Nama Modul & Deskripsi Pembahasan", "Halaman"]],
    body: tocItems.map((item) => [item.no, `${item.title}\n${item.desc}`, item.page]),
    theme: "striped",
    headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
    bodyStyles: { fontSize: 8.5, textColor: [51, 65, 85], cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 18, fontStyle: "bold", halign: "center" },
      1: { cellWidth: 145 },
      2: { cellWidth: 19, halign: "center", fontStyle: "bold" },
    },
  });

  // Architectural Box
  const tableFinalY = (doc as any).lastAutoTable.finalY + 8;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, tableFinalY, pageWidth - 28, 48, 3, 3, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 58, 138);
  doc.text("Keunggulan Arsitektur Sistem untuk Klien:", 20, tableFinalY + 8);

  const pillars = [
    "1. Kecepatan Operasional Tinggi: Kasir tetap cepat tanpa lag meskipun server memproses laporan besar.",
    "2. Anti-Kebocoran Kas & Stok: Formula resep otomatis memotong bahan baku dan PIN Manajer mengunci void/refund.",
    "3. Ketahanan Mode Offline: Jika WiFi kafe terputus, kasir tetap dapat mengetik pesanan & cetak struk lokal.",
    "4. Transparansi Bisnis: Pemilik usaha dapat memantau omzet, laba bersih, dan aset stok dari jarak jauh secara real-time.",
  ];

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  pillars.forEach((p, idx) => {
    doc.text(p, 20, tableFinalY + 16 + idx * 7.5);
  });

  // ==========================================
  // PAGE 3: ROLE MATRIX & TERMINAL KASIR (POS)
  // ==========================================
  doc.addPage();
  addHeaderFooter(3, 6, "2. ROLE AKSES & TERMINAL KASIR (POS)");

  addSectionTitle("Matriks Peran Pengguna (Role & Permissions)", 18, "Pembagian kewenangan untuk menjamin tata kelola kafe yang akuntabel");

  const rolesData = [
    ["Owner / Pemilik", "Akses 100% penuh: Laba Bersih, Pengaturan Kedai, Tambah Akun, Ekspor Master, HPP"],
    ["Manajer Operasional", "Supervisi shift, stok opname, checklist tim, approval void struk, pembelian PO"],
    ["Kasir (Cashier)", "Akses khusus /pos: Buka/tutup shift kas, transaksi, open bill meja, cetak struk"],
    ["Barista & Koki (Chef)", "Akses khusus /kds: Menerima tiket pesanan, timer racik minuman/makanan, selesai saji"],
    ["Leader Shift", "Checklist kebersihan pembukaan/penutupan kafe, supervisi presensi tim harian"],
    ["Finance / Akuntan", "Pencatatan kas operasional, rekonsiliasi mutasi bank, dan penggajian payroll"],
  ];

  autoTable(doc, {
    startY: 32,
    head: [["Peran (Role)", "Cakupan Hak Akses & Kewenangan di Sistem"]],
    body: rolesData,
    theme: "grid",
    headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8.5 },
    bodyStyles: { fontSize: 8, textColor: [51, 65, 85], cellPadding: 2.2 },
    columnStyles: {
      0: { cellWidth: 45, fontStyle: "bold" },
      1: { cellWidth: 137 },
    },
  });

  const posSectionY = (doc as any).lastAutoTable.finalY + 8;
  addSectionTitle("Panduan Operasional Terminal Kasir (/pos)", posSectionY, "Alur lengkap transaksi, multi-meja, pelunasan, dan printer thermal");

  const posSteps = [
    {
      step: "A. Buka Shift & Modal Kas",
      desc: "Kasir menginput modal uang kembalian di laci kas (Opening Float). Sistem mencatat jam mulai dan identitas kasir yang bertugas.",
    },
    {
      step: "B. Input Pesanan & Varian",
      desc: "Kasir memilih menu, ukuran (Regular/Large), suhu (Hot/Iced), dan modifier (Extra shot, oat milk). Catatan pelanggan tercetak di tiket dapur.",
    },
    {
      step: "C. Open Bill (Bayar Nanti)",
      desc: "Untuk pesanan Dine-In, kasir klik 'Simpan Bill Meja'. Tiket otomatis meluncur ke KDS Dapur/Bar tanpa harus bayar duluan di muka.",
    },
    {
      step: "D. Pelunasan Multi-Metode",
      desc: "Mendukung Tunai (kembalian otomatis), QRIS (verifikasi sukses), EDC Kartu Debit/Kredit (input no. referensi), dan Transfer Bank.",
    },
    {
      step: "E. Otorisasi Void / Refund",
      desc: "Pembatalan transaksi terbayar wajib memasukkan alasan dan PIN Manajer untuk mengembalikan saldo kas dan stok bahan ke gudang.",
    },
    {
      step: "F. Setup Printer Thermal",
      desc: "Mendukung koneksi Bluetooth, LAN Wi-Fi (port 9100), dan USB OTG (kertas 58mm & 80mm). Didukung fitur Silent Printing instan.",
    },
  ];

  autoTable(doc, {
    startY: posSectionY + 14,
    head: [["Tahapan Kasir", "Standard Operating Procedure (SOP) Detail"]],
    body: posSteps.map((s) => [s.step, s.desc]),
    theme: "striped",
    headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8.5 },
    bodyStyles: { fontSize: 8, textColor: [51, 65, 85], cellPadding: 2.2 },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: "bold" },
      1: { cellWidth: 132 },
    },
  });

  // ==========================================
  // PAGE 4: KDS, INVENTORI & HPP MARGIN
  // ==========================================
  doc.addPage();
  addHeaderFooter(4, 6, "3. KDS, INVENTORI & RESEP HPP");

  addSectionTitle("Kitchen Display System (/kds)", 18, "Antarmuka tanpa kertas (paperless) untuk efisiensi peracikan pesanan");

  const kdsCards = [
    { title: "Bar Minuman", info: "Khusus barista: Kopi, teh, mocktail, susu. Timer durasi racik otomatis berjalan." },
    { title: "Kitchen Makanan", info: "Khusus koki dapur: Makanan berat, pasta, nasi goreng, cemilan panas." },
    { title: "Bakery & Pastry", info: "Khusus tim baker: Croissant, roti bakar, kue etalase, dessert." },
  ];

  let kdsX = 14;
  kdsCards.forEach((c) => {
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(kdsX, 32, 58, 22, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(30, 58, 138);
    doc.text(c.title, kdsX + 4, 38);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    const lines = doc.splitTextToSize(c.info, 50);
    doc.text(lines, kdsX + 4, 43);

    kdsX += 62;
  });

  const invSectionY = 62;
  addSectionTitle("Inventori, Resep Otomatis & Analisis HPP", invSectionY, "Pengendalian biaya bahan baku (COGS) dan proteksi kebocoran stok");

  const invPoints = [
    ["Master Bahan Baku", "Pencatatan satuan baku (gram, ml, pcs) dan batas minimum stok (Reorder point alert saat stok menipis)."],
    ["Formula Resep Menu", "Setiap porsi menu terhubung ke bahan baku. Penjualan di kasir otomatis memotong stok tanpa hitung manual."],
    ["Pembelian (PO) Supplier", "Pencatatan Purchase Order ke pemasok. Saat barang diterima (Received), stok bertambah dan biaya tercatat."],
    ["Stok Opname Selisih", "Penghitungan fisik berkala. Sistem menghitung selisih (Loss/Surplus) untuk evaluasi investigasi tim."],
    ["Pencatatan Waste / Buangan", "Mencatat bahan terbuang akibat tumpah, susu basi, atau kalibrasi espresso untuk transparansi kerugian."],
    ["Kalkulator Simulasi HPP", "Menghitung biaya pokok per porsi dan merekomendasikan harga jual ideal berdasarkan target margin (misal: 70%)."],
  ];

  autoTable(doc, {
    startY: invSectionY + 14,
    head: [["Komponen Inventori", "Fungsi & Nilai Manajerial"]],
    body: invPoints,
    theme: "grid",
    headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8.5 },
    bodyStyles: { fontSize: 8, textColor: [51, 65, 85], cellPadding: 2.3 },
    columnStyles: {
      0: { cellWidth: 48, fontStyle: "bold" },
      1: { cellWidth: 134 },
    },
  });

  // Example Recipe Flow
  const recipeBoxY = (doc as any).lastAutoTable.finalY + 8;
  doc.setFillColor(254, 243, 199); // amber-100
  doc.setDrawColor(245, 158, 11);
  doc.roundedRect(14, recipeBoxY, pageWidth - 28, 28, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(146, 64, 14); // amber-900
  doc.text("💡 Contoh Nyata Alur Resep Otomatis (Auto-Deduct):", 20, recipeBoxY + 7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(120, 53, 15);
  doc.text("Menu: 1x Iced Caramel Latte (Rp 32.000)", 20, recipeBoxY + 13);
  doc.text("Sistem otomatis memotong: 18g Biji Kopi + 150ml Susu UHT + 20ml Sirup Karamel + 1 Cup 16oz + 1 Tutup + 1 Sedotan.", 20, recipeBoxY + 18);
  doc.text("HPP Bahan: Rp 8.800 • Gross Margin: 72,5% (Rp 23.200 per cup) • Status: Profitabel dan Terkontrol Presisi.", 20, recipeBoxY + 23);

  // ==========================================
  // PAGE 5: SDM, PAYROLL & KEUANGAN (FINANCE)
  // ==========================================
  doc.addPage();
  addHeaderFooter(5, 6, "4. SDM, PAYROLL & KEUANGAN");

  addSectionTitle("SDM, Presensi GPS Selfie & Penggajian (/hr, /payroll)", 18, "Manajemen kedisiplinan kerja dan penggajian transparan");

  const hrPoints = [
    ["Presensi GPS & Selfie", "Karyawan wajib selfie di lokasi kafe. Sistem memvalidasi radius geofencing GPS agar tidak bisa titip absen."],
    ["Checklist Shift Leader", "SOP harian Opening, Running, dan Closing (kalibrasi mesin kopi, kebersihan bar, suhu kulkas, kunci pintu)."],
    ["Penilaian Skor KPI", "Evaluasi kinerja berkala (Disiplin, SOP Resep, Hospitality). Menentukan grade (A, B, C, D) dan bonus bulanan."],
    ["Payroll & Slip Gaji", "Perhitungan otomatis: Gaji Pokok + Tunjangan + Lembur + Bonus KPI - Potongan Alpha. Cetak slip PDF / thermal."],
  ];

  autoTable(doc, {
    startY: 32,
    head: [["Fitur SDM & HRD", "Deskripsi & Mekanisme Kerja"]],
    body: hrPoints,
    theme: "striped",
    headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8.5 },
    bodyStyles: { fontSize: 8, textColor: [51, 65, 85], cellPadding: 2.2 },
    columnStyles: {
      0: { cellWidth: 48, fontStyle: "bold" },
      1: { cellWidth: 134 },
    },
  });

  const finSectionY = (doc as any).lastAutoTable.finalY + 8;
  addSectionTitle("Manajemen Keuangan & Arus Kas (/cash_flow)", finSectionY, "Pembukuan kas laci, kas kecil, dan mutasi rekening bank");

  const finPoints = [
    ["Buku Kas Masuk / Keluar", "Mencatat seluruh arus kas operasional (biaya listrik, gas LPG, es batu, belanja pasar, dan utilitas)."],
    ["Multi-Akun Kas", "Pemisahan saldo: Kas Laci Kasir (Cash Drawer), Kas Kecil (Petty Cash), dan Rekening Bank Operasional."],
    ["Rekonsiliasi Bank", "Mencocokkan mutasi rekening koran dengan transaksi POS untuk memastikan pembayaran QRIS/EDC masuk utuh."],
    ["Laporan Laba Rugi", "Menghitung Estimasi Laba Bersih Operasional = Penjualan Bersih - Kas Keluar - Beban Payroll Karyawan."],
  ];

  autoTable(doc, {
    startY: finSectionY + 14,
    head: [["Modul Keuangan", "Tujuan Manajerial & Manfaat untuk Owner"]],
    body: finPoints,
    theme: "grid",
    headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8.5 },
    bodyStyles: { fontSize: 8, textColor: [51, 65, 85], cellPadding: 2.2 },
    columnStyles: {
      0: { cellWidth: 48, fontStyle: "bold" },
      1: { cellWidth: 134 },
    },
  });

  // ==========================================
  // PAGE 6: PUSAT EKSPOR LAPORAN & FAQ KENDALA
  // ==========================================
  doc.addPage();
  addHeaderFooter(6, 6, "5. EKSPOR LAPORAN & FAQ KENDALA");

  addSectionTitle("Pusat Ekspor & Laporan Bisnis Eksekutif", 18, "Laporan terpadu siap cetak dan olah data untuk akuntan / investor");

  const exportTable = [
    ["👑 Laporan Master (All-in-One)", "Excel .xlsx (7 Sheet Mandiri)", "Menghasilkan 1 file Excel memuat: Ringkasan Eksekutif, Penjualan, Arus Kas, Inventori Stok, Slip Payroll, Log Absensi, dan Skor KPI."],
    ["👑 Laporan Eksekutif Master", "Berkas PDF Siap Cetak", "Ringkasan metrik finansial, omzet kotor, penjualan bersih, kas operasional, laba bersih, dan aset persediaan tanpa teks bertumpuk."],
    ["Laporan Penjualan (Sales)", "PDF & CSV", "Rincian struk per produk, quantity terjual, omzet harian/bulanan, dan metode bayar."],
    ["Laporan Stok Bahan Baku", "PDF & CSV", "Daftar saldo stok sisa, harga rata-rata, dan total nilai aset persediaan kafe."],
    ["Laporan Arus Kas (Cash Flow)", "PDF & CSV", "Daftar pemasukan & pengeluaran berdasarkan kategori beban usaha."],
  ];

  autoTable(doc, {
    startY: 32,
    head: [["Jenis Laporan", "Format File", "Cakupan Data & Kegunaan"]],
    body: exportTable,
    theme: "striped",
    headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8.5 },
    bodyStyles: { fontSize: 8, textColor: [51, 65, 85], cellPadding: 2.2 },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: "bold" },
      1: { cellWidth: 40, fontStyle: "bold", textColor: [15, 118, 110] },
      2: { cellWidth: 92 },
    },
  });

  const faqY = (doc as any).lastAutoTable.finalY + 8;
  addSectionTitle("Standar Operasional (SOP) Penanganan Kendala", faqY, "Solusi cepat penanganan kendala teknis di kedai");

  const faqs = [
    {
      q: "1. Bagaimana jika printer thermal kasir macet / tidak mencetak?",
      a: "Pastikan kertas thermal terpasang benar dan tuas tertutup rapat. Jika via Bluetooth, hidupkan ulang Bluetooth tablet dan klik 'Pindai & Pasangkan'. Jika via USB, pastikan kabel OTG tercolok kencang dan margin print browser disetel ke 'None'.",
    },
    {
      q: "2. Bagaimana jika jaringan internet kafe tiba-tiba terputus?",
      a: "Sistem memiliki fitur Offline Resilience: kasir tetap dapat menginput pesanan dan mencetak struk kasir lokal. Data tersimpan di memori browser dan otomatis tersinkronisasi ke cloud begitu internet terhubung kembali.",
    },
    {
      q: "3. Apa yang harus dilakukan jika terjadi selisih kas saat tutup shift?",
      a: "Periksa kembali laci uang dan kuitansi kas kecil darurat. Masukkan nominal fisik aktual apa adanya. Sistem mencatat selisih tersebut secara transparan di slip rekap shift untuk evaluasi manajer tanpa memanipulasi data.",
    },
  ];

  autoTable(doc, {
    startY: faqY + 14,
    head: [["Pertanyaan / Situasi Kendala", "Langkah Penyelesaian SOP"]],
    body: faqs.map((f) => [f.q, f.a]),
    theme: "grid",
    headStyles: { fillColor: [245, 158, 11], textColor: [15, 23, 42], fontStyle: "bold", fontSize: 8.5 },
    bodyStyles: { fontSize: 8, textColor: [51, 65, 85], cellPadding: 2.5 },
    columnStyles: {
      0: { cellWidth: 55, fontStyle: "bold" },
      1: { cellWidth: 127 },
    },
  });

  // End Box
  const endY = (doc as any).lastAutoTable.finalY + 6;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("— Dokumen Buku Panduan Pengguna Resmi Coffee Management & POS System —", pageWidth / 2, endY, { align: "center" });

  // Save to target outputs
  const outputPdfPath = path.resolve(
    process.cwd(),
    "Buku_Panduan_Resmi_Coffee_Management_POS.pdf"
  );
  const distPdfPath = path.resolve(
    process.cwd(),
    "public",
    "Buku_Panduan_Resmi_Coffee_Management_POS.pdf"
  );

  const pdfBytes = doc.output("arraybuffer");
  const buffer = Buffer.from(pdfBytes);
  fs.writeFileSync(outputPdfPath, buffer);
  
  if (!fs.existsSync(path.resolve(process.cwd(), "public"))) {
    fs.mkdirSync(path.resolve(process.cwd(), "public"), { recursive: true });
  }
  fs.writeFileSync(distPdfPath, buffer);

  console.log(`PDF berhasil dibuat di:\n1. ${outputPdfPath}\n2. ${distPdfPath}`);
}

generateManualPdf().catch(console.error);
