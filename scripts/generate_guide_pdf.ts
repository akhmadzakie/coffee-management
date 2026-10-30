import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import fs from "fs";
import path from "path";

// Bulletproof jsPDF Constructor
const JsPDFConstructor: any =
  typeof jsPDF === "function" ? jsPDF : (jsPDF as any)?.default || jsPDF;

// Helper to load image to base64
const loadBase64Image = (filePath: string): string => {
  try {
    if (fs.existsSync(filePath)) {
      const buf = fs.readFileSync(filePath);
      const ext = path.extname(filePath).replace(".", "").toLowerCase();
      const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
      return `data:${mime};base64,${buf.toString("base64")}`;
    }
  } catch (e) {
    console.warn(`Could not load image: ${filePath}`, e);
  }
  return "";
};

const LOGO_IMG = loadBase64Image(path.join(process.cwd(), "public", "logo-client.png"));
const SCREEN_LOGIN = loadBase64Image(path.join(process.cwd(), "public", "screenshots", "01_login_screen.png"));
const SCREEN_DASHBOARD = loadBase64Image(path.join(process.cwd(), "public", "screenshots", "02_dashboard.png"));
const SCREEN_POS = loadBase64Image(path.join(process.cwd(), "public", "screenshots", "03_pos_terminal.png"));
const SCREEN_KDS = loadBase64Image(path.join(process.cwd(), "public", "screenshots", "04_kds_screen.png"));
const SCREEN_LEADER = loadBase64Image(path.join(process.cwd(), "public", "screenshots", "04_leader_checklist.png"));
const SCREEN_INVENTORY = loadBase64Image(path.join(process.cwd(), "public", "screenshots", "05_inventory_screen.png"));
const SCREEN_CASHFLOW = loadBase64Image(path.join(process.cwd(), "public", "screenshots", "06_cashflow_screen.png"));
const SCREEN_PAYROLL = loadBase64Image(path.join(process.cwd(), "public", "screenshots", "07_payroll_screen.png"));
const SCREEN_USERS_PIN = loadBase64Image(path.join(process.cwd(), "public", "screenshots", "08_users_pin_screen.png"));

// ── COLOR PALETTE ──
const BRAND_NAVY = [15, 23, 42];     // slate-900
const BRAND_AMBER = [245, 158, 11];  // amber-500
const BRAND_EMERALD = [5, 150, 105]; // emerald-600
const ACCENT_BLUE = [30, 58, 138];   // blue-900
const TEXT_DARK = [30, 41, 59];      // slate-800
const TEXT_MUTED = [100, 116, 139];  // slate-500
const BG_LIGHT = [248, 250, 252];    // slate-50
const BORDER_LIGHT = [226, 232, 240];// slate-200

// Helper to draw clean page header
const addHeaderFooter = (doc: any, pageNumber: number, totalPages: number, sectionTitle: string) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // Top header banner
  doc.setFillColor(30, 58, 138); // Navy blue
  doc.rect(margin, 10, pageWidth - margin * 2, 0.8, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(30, 58, 138);
  doc.text("JULIA'S COFFEE & EATERY — INTEGRATED POS & ERP", margin, 7.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(sectionTitle.toUpperCase(), pageWidth - margin, 7.5, { align: "right" });

  // Bottom footer line
  doc.setFillColor(226, 232, 240);
  doc.rect(margin, pageHeight - 12, pageWidth - margin * 2, 0.5, "F");

  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text("Buku Panduan Pengguna & Standar Operasional Kafe — Edisi Resmi November 2026", margin, pageHeight - 7);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Halaman ${pageNumber} dari ${totalPages}`, pageWidth - margin, pageHeight - 7, { align: "right" });
};

// Helper for section title (Format Klasik yang Disukai Pengguna)
const addSectionTitle = (doc: any, title: string, yPos: number, subtitle?: string) => {
  doc.setFillColor(30, 58, 138);
  doc.roundedRect(14, yPos, 3.5, 12, 1, 1, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(title, 21, yPos + 5.5);

  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(subtitle, 21, yPos + 10.5);
    return yPos + 15;
  }
  return yPos + 13;
};

// Helper to draw image with neat border & caption
const drawImageBox = (
  doc: any,
  imgBase64: string,
  x: number,
  y: number,
  w: number,
  h: number,
  caption: string
) => {
  doc.setFillColor(BG_LIGHT[0], BG_LIGHT[1], BG_LIGHT[2]);
  doc.setDrawColor(BORDER_LIGHT[0], BORDER_LIGHT[1], BORDER_LIGHT[2]);
  doc.roundedRect(x - 1, y - 1, w + 2, h + 6.5, 1.5, 1.5, "FD");

  if (imgBase64) {
    try {
      doc.addImage(imgBase64, "PNG", x, y, w, h);
    } catch (e) {
      console.warn("Could not render image box:", e);
    }
  }

  doc.setFontSize(5.8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
  doc.text(caption, x + w / 2, y + h + 4, { align: "center" });

  return y + h + 8;
};

// Helper to draw Case Study Box (Kotak Simulasi Kasus Nyata)
const drawCaseStudyBox = (
  doc: any,
  x: number,
  y: number,
  w: number,
  title: string,
  scenario: string,
  steps: string[],
  result: string
) => {
  const boxH = 39;
  doc.setFillColor(254, 252, 232); // amber-50
  doc.setDrawColor(245, 158, 11);  // amber-500
  doc.roundedRect(x, y, w, boxH, 1.5, 1.5, "FD");

  // Badge Header
  doc.setFillColor(245, 158, 11);
  doc.roundedRect(x + 2.5, y + 2.5, 36, 4, 0.8, 0.8, "F");
  doc.setFontSize(5.8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("CONTOH KASUS OPERASIONAL", x + 3.8, y + 5.2);

  doc.setFontSize(6.8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(146, 64, 14);
  doc.text(title, x + 41, y + 5.4);

  // Scenario
  doc.setFontSize(6);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Skenario:", x + 3.5, y + 10);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 41, 59);
  const scLines = doc.splitTextToSize(scenario, w - 20);
  doc.text(scLines[0], x + 17, y + 10);

  // Steps
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Langkah:", x + 3.5, y + 16.5);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 41, 59);
  let stepY = y + 16.5;
  steps.slice(0, 3).forEach((st, idx) => {
    const lines = doc.splitTextToSize(`${idx + 1}. ${st}`, w - 20);
    doc.text(lines[0], x + 17, stepY);
    stepY += 3.6;
  });

  // Result Banner
  doc.setFillColor(240, 253, 244); // emerald-50
  doc.setDrawColor(52, 211, 153);  // emerald-400
  doc.roundedRect(x + 2.5, y + 29.5, w - 5, 7, 1, 1, "FD");

  doc.setFontSize(5.8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(6, 95, 70);
  doc.text("Hasil Sistem:", x + 4.5, y + 34);

  doc.setFont("helvetica", "normal");
  doc.text(result, x + 21, y + 34);

  return y + boxH + 4;
};

// ============================================================================
// MAIN GENERATOR: BUKU PANDUAN LENGKAP KOMBINASI TERBAIK (14 HALAMAN)
// ============================================================================
export const generateCombinedOfficialManual = () => {
  const doc = new JsPDFConstructor("p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const colW = (contentWidth - 6) / 2;
  const descX = margin + colW + 6;
  const descW = contentWidth - (colW + 6);
  const totalPages = 14;

  console.log("Generating 14-Page Master Manual combining classic layout + real screenshots...");

  // ════════════════════════════════════════════════════════════════════════════
  // HALAMAN 1: COVER EKSEKUTIF (FORMAT KLASIK YANG DISUKAI PENGGUNA)
  // ════════════════════════════════════════════════════════════════════════════
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

  // Logo in header if present
  if (LOGO_IMG) {
    try {
      doc.addImage(LOGO_IMG, "PNG", pageWidth - 48, 22, 34, 34);
    } catch {}
  }

  // Badge
  doc.setFillColor(245, 158, 11);
  doc.roundedRect(20, 24, 75, 7, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text("EDISI RESMI KLIEN & OPERASIONAL KEDAI", 24, 28.5);

  // Big Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(255, 255, 255);
  doc.text("JULIA'S COFFEE & EATERY", 20, 48);
  doc.setFontSize(22);
  doc.text("MANAGEMENT & POS SYSTEM", 20, 59);

  // Tagline
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(191, 219, 254);
  doc.text("Buku Panduan Pengguna, Alur Operasional & Standar Prosedur (SOP)", 20, 72);
  doc.setFontSize(8.5);
  doc.setTextColor(147, 197, 253);
  doc.text("Platform All-in-One: Kasir POS, Kitchen Display, Inventori Resep, Leader, HR & Finansial", 20, 80);
  doc.text("Versi Sistem: 2.4.0 (Production Ready)  •  Edisi: November 2026", 20, 86);

  // Content Feature Cards on Cover (6 Pilar Utama Format Lama)
  const coverFeatures = [
    { title: "Point of Sale (POS)", desc: "Kasir tablet kilat, multi-meja, open bill, split bill, cetak thermal & WhatsApp." },
    { title: "Kitchen Display (KDS)", desc: "Tiket pesanan digital tanpa kertas untuk Barista, Chef Dapur, dan Pastry Baker." },
    { title: "Inventori & Resep (BOM)", desc: "Auto-deduct stok, kalkulasi HPP margin profit, & stok opname presisi." },
    { title: "Supervisi Leader Bar", desc: "Checklist kebersihan opening/closing, kalibrasi espresso pagi, & otorisasi kasir." },
    { title: "Keuangan & Kas (Finance)", desc: "Buku kas harian, petty cash belanja darurat, & rekonsiliasi transfer/QRIS bank." },
    { title: "SDM & Penggajian (Payroll)", desc: "Presensi GPS radius kedai, lembur otomatis, bonus omzet, & slip gaji digital." },
  ];

  let cardY = 126;
  coverFeatures.forEach((feat, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = col === 0 ? 20 : 110;
    const y = cardY + row * 32;

    doc.setFillColor(30, 41, 59); // slate-800
    doc.roundedRect(x, y, 80, 26, 3, 3, "F");

    doc.setFillColor(245, 158, 11);
    doc.circle(x + 6, y + 8, 1.8, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(feat.title, x + 11, y + 9);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.2);
    doc.setTextColor(148, 163, 184);
    const splitDesc = doc.splitTextToSize(feat.desc, 68);
    doc.text(splitDesc, x + 11, y + 16);
  });

  // Footer Cover
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text("Dokumen Panduan Sah — Hak Cipta Dilindungi © 2026 Julia's Coffee & Eatery", pageWidth / 2, pageHeight - 12, { align: "center" });

  // ════════════════════════════════════════════════════════════════════════════
  // HALAMAN 2: RINGKASAN EKSEKUTIF & DAFTAR ISI LENGKAP
  // ════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  addHeaderFooter(doc, 2, totalPages, "1. RINGKASAN & DAFTAR ISI");

  let curY = addSectionTitle(doc, "Ringkasan Eksekutif & Nilai Tambah Platform", 18, "Solusi holistik operasional bisnis Food & Beverage terpadu");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.8);
  doc.setTextColor(51, 65, 85);
  const execSummary =
    "Sistem Manajemen & POS Julia's Coffee dirancang khusus untuk memenuhi standar operasional kedai kopi specialty " +
    "dan restoran modern. Mengintegrasikan pencatatan kasir di garda depan (Front of House) dengan stasiun produksi " +
    "barista dan dapur (Back of House), didukung sistem resep deduksi otomatis bahan baku (BOM), rekonsiliasi kas laci malam, " +
    "pengawasan terpadu peran Leader dan Finance, serta dashboard laba rugi eksekutif bagi Owner secara real-time.";
  doc.text(doc.splitTextToSize(execSummary, contentWidth), margin, curY);

  curY += 20;

  // Tabel Daftar Isi
  const tocData = [
    ["Bab 01", "Matriks 9 Peran Pengguna & SOP Penggantian PIN Tersentralisasi", "Hal 03"],
    ["Bab 02", "Operasional Terminal Kasir POS: Katalog, Dine In Meja & Take Away", "Hal 04"],
    ["Bab 03", "Alur Pembayaran Kasir, Split Bill (Pecah Tagihan) & Struk Thermal / WA", "Hal 05"],
    ["Bab 04", "Otorisasi Supervisor, Pembatalan Pesanan (Void) & Penanganan Refund", "Hal 06"],
    ["Bab 05", "Kitchen Display System (KDS): Antrean Stasiun Bar, Dapur & Bakery", "Hal 07"],
    ["Bab 06", "Peran LEADER: Supervisi Bar, Kalibrasi Dial-In Espresso & Waste Tracking", "Hal 08"],
    ["Bab 07", "Prosedur Tutup Shift Kasir Malam, Rekonsiliasi Kas Laci & Z-Report", "Hal 09"],
    ["Bab 08", "Manajemen Resep (BOM), Kartu Stok Bahan & Audit Stok Opname Mingguan", "Hal 10"],
    ["Bab 09", "Peran FINANCE: Buku Kas, Petty Cash, Pembelian PO & Rekonsiliasi Bank", "Hal 11"],
    ["Bab 10", "SDM, Presensi GPS Selfie & Penggajian Karyawan (Payroll)", "Hal 12"],
    ["Bab 11", "Dashboard Eksekutif Owner, Audit Trail & Protokol Reset Data Uji Coba", "Hal 13"],
    ["Bab 12", "Pusat Ekspor Laporan Bisnis (Excel 7-Sheet) & SOP Troubleshooting", "Hal 14"],
  ];

  autoTable(doc, {
    startY: curY,
    head: [["Bab", "Nama Modul & Deskripsi Pembahasan", "Halaman"]],
    body: tocData,
    theme: "striped",
    headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7.5 },
    bodyStyles: { fontSize: 7, textColor: [51, 65, 85], cellPadding: 1.8 },
    columnStyles: {
      0: { cellWidth: 18, fontStyle: "bold", textColor: [30, 58, 138] },
      1: { cellWidth: 144 },
      2: { cellWidth: 20, halign: "center", fontStyle: "bold", textColor: [245, 158, 11] },
    },
    margin: { left: margin, right: margin },
  });

  curY = (doc as any).lastAutoTable.finalY + 6;

  // Box Arsitektur Hybrid Offline-Resilience (Gaya Format Lama)
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, curY, contentWidth, 24, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.8);
  doc.setTextColor(30, 58, 138);
  doc.text("KEUNGGULAN ARSITEKTUR HYBRID & OFFLINE RESILIENCE", margin + 4, curY + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(71, 85, 105);
  const archText =
    "Aplikasi dirancang dengan teknologi Progressive Web App (PWA) dan local queue caching. Apabila koneksi internet kafe " +
    "terputus atau listrik padam, kasir TETAP DAPAT MELAYANI TRANSAKSI TUNAI dan mencetak struk thermal lokal secara lancar. " +
    "Seluruh antrean data disimpan aman di penyimpanan browser lokal dan otomatis tersinkronisasi ke cloud database saat online kembali.";
  doc.text(doc.splitTextToSize(archText, contentWidth - 8), margin + 4, curY + 11.5);

  // ════════════════════════════════════════════════════════════════════════════
  // HALAMAN 3: BAB 1 - MATRIKS 9 ROLE & CARA GANTI PIN TERSENTRALISASI
  // ════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  addHeaderFooter(doc, 3, totalPages, "2. MATRIKS ROLE & GANTI PIN");

  curY = addSectionTitle(doc, "Matriks Peran Pengguna (Role & Permissions)", 18, "Pembagian wewenang untuk menjamin akuntabilitas kas dan inventori");

  const rolesData = [
    ["SUPER_ADMIN", "admin", "Super Admin", "Akses 100% penuh: Database maintenance, audit log, konfigurasi, reset data."],
    ["OWNER", "owner", "Owner Julia's", "Mode Eksekutif: Dashboard omzet, laba rugi realtime, audit log, payroll."],
    ["MANAGER", "manager", "Manager Operasional", "Otorisasi PIN Void/Refund, Approval Diskon, Pengadaan Bahan PO, SDM & HR."],
    ["KASIR", "kasir", "Terminal Kasir POS", "Buka/tutup shift kasir, transaksi meja, split bill, cetak nota thermal & WA."],
    ["LEADER", "leader", "Rama (Leader Bar)", "Checklist bar, supervisi kalibrasi kopi, waste tracking, stok opname bar."],
    ["BAR", "barista", "Budi (Barista)", "Layar KDS Barista, antrean minuman (Cooking/Done), presensi GPS selfie."],
    ["KITCHEN", "kitchen", "Chef Dapur", "Layar KDS Dapur, antrean makanan hangat, resep dapur, catat waste masakan."],
    ["BAKER", "baker", "Pastry Baker", "Layar KDS Pastry, antrean croissant & cake, stok etalase showcase."],
    ["FINANCE", "finance", "Finance & Accounting", "Buku kas operasional, petty cash belanja darurat, payroll, rekonsiliasi bank."]
  ];

  autoTable(doc, {
    startY: curY,
    head: [["Role", "User", "Nama Akun", "Cakupan Otoritas di Aplikasi"]],
    body: rolesData,
    theme: "grid",
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 6.8 },
    bodyStyles: { fontSize: 6.2, textColor: TEXT_DARK as any, cellPadding: 1.2 },
    columnStyles: {
      0: { cellWidth: 26, fontStyle: "bold" },
      1: { cellWidth: 16, fontStyle: "bold", textColor: ACCENT_BLUE as any },
      2: { cellWidth: 32 },
      3: { cellWidth: 108, textColor: [71, 85, 105] },
    },
    margin: { left: margin, right: margin },
  });

  curY = (doc as any).lastAutoTable.finalY + 6;

  curY = addSectionTitle(doc, "Prosedur Resmi Penggantian PIN Pengguna (Tersentralisasi)", curY, "Kebijakan keamanan data: Staf dilarang mengganti PIN sendiri demi kepatuhan audit");

  // Split: Left Steps, Right Real Screenshot of Users PIN management
  const pinSplitY = curY;
  drawImageBox(doc, SCREEN_USERS_PIN, margin + colW + 4, pinSplitY, colW - 4, 46, "Gambar 1.1: Menu Manajemen Pengguna & Reset PIN");

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2]);
  doc.text("Alur Resmi Saat Staf Lupa atau Ganti PIN:", margin, pinSplitY + 4);

  doc.setFontSize(6.2);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
  const pinSteps = [
    "1. Staf biasa (Kasir, Barista, Kitchen, dll.) TIDAK MEMILIKI akses untuk mengganti PIN sendiri di profil.",
    "2. Jika staf lupa PIN atau dijadwalkan rotasi PIN berkala, staf wajib melapor ke MANAGER atau SUPER ADMIN.",
    "3. Manager/Admin login -> Buka menu [Sistem & Admin] -> Klik [Manajemen Pengguna].",
    "4. Cari nama staf bersangkutan pada tabel -> Klik tombol [Edit Pengguna].",
    "5. Ketikkan 4 s/d 6 digit PIN baru pada kolom 'PIN Akses' -> Klik [Simpan Perubahan].",
    "6. Sistem meng-hash PIN baru dengan SHA-256 dan mencatat aktivitas ini ke Audit Log."
  ];
  pinSteps.forEach((ps, idx) => {
    const l = doc.splitTextToSize(ps, colW);
    doc.text(l, margin, pinSplitY + 9 + idx * 6.5);
  });

  // ════════════════════════════════════════════════════════════════════════════
  // HALAMAN 4: BAB 2 - TERMINAL KASIR POS & PEMESANAN DINE IN
  // ════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  addHeaderFooter(doc, 4, totalPages, "3. TERMINAL KASIR POS");

  curY = addSectionTitle(doc, "Panduan Operasional Terminal Kasir (/pos)", 18, "Antarmuka kasir cepat: multi-meja, modifier takaran resep, & simpan bill");

  const posSplitY = curY;
  drawImageBox(doc, SCREEN_POS, margin, posSplitY, colW + 6, 52, "Gambar 2.1: Antarmuka Terminal Kasir POS Julia's Coffee");

  doc.setFontSize(7.2);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2]);
  doc.text("Penjelasan Area Kerja Layar Kasir:", descX, posSplitY + 4);

  doc.setFontSize(6.2);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
  const posExpl = [
    "• Tab Tipe Layanan: Pilih 'Dine In' (Nomor Meja 01 s/d 20) atau 'Take Away' (Bungkus).",
    "• Katalog Menu: Filter per kategori (Coffee, Non-Coffee, Eatery, Snack, Pastry) dengan indikator stok.",
    "• Sheet Modifier: Pengaturan varian Hot/Iced, tingkat kemanisan (Normal/Less/No Sugar), dan extra shot.",
    "• Simpan Meja (Open Bill): Mengirimkan pesanan ke KDS Dapur/Bar tanpa harus bayar seketika.",
    "• Bayar Sekarang: Membuka jendela pembayaran lunas (Cash, QRIS, Kartu, Split Bill)."
  ];
  posExpl.forEach((pe, idx) => {
    const l = doc.splitTextToSize(pe, descW);
    doc.text(l, descX, posSplitY + 9 + idx * 7.5);
  });

  curY = posSplitY + 59;
  curY = addSectionTitle(doc, "Studi Kasus Pemesanan Bertahap Meja 04", curY, "Simulasi tamu duduk dan memesan menu secara bertahap");

  drawCaseStudyBox(
    doc,
    margin,
    curY,
    contentWidth,
    "Tamu Meja 04: Pesan Kopi, Lalu Menambah Makanan Nanti",
    "Pelanggan 2 orang datang pukul 14:00 WITA di Meja 04, pesan 2 Kopi Susu Aren (Less Sugar). 30 menit kemudian mereka pesan 1 Nasi Goreng Special.",
    [
      "Kasir sentuh tab 'Dine In' -> Pilih Meja 04 -> Sentuh Kopi Susu Aren 2x (pilih Less Sugar) -> Klik 'Simpan Bill Meja'.",
      "Tiket kopi seketika muncul di KDS Barista. Tamu menikmati minumannya.",
      "Saat tamu pesan makan, kasir buka tab 'Bill Meja' -> Meja 04 -> Sentuh 'Nasi Goreng' -> Klik 'Update Pesanan Meja'."
    ],
    "Pesanan terakumulasi rapi di Meja 04 tanpa bon terpisah atau bon kertas hilang, dan siap dibayar lunas saat checkout."
  );

  // ════════════════════════════════════════════════════════════════════════════
  // HALAMAN 5: BAB 3 - PEMBAYARAN, SPLIT BILL & STRUK THERMAL/WA
  // ════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  addHeaderFooter(doc, 5, totalPages, "4. PEMBAYARAN & SPLIT BILL");

  curY = addSectionTitle(doc, "Alur Pembayaran Kasir & Split Bill Tagihan", 18, "Mendukung Cash, QRIS Statis/Dinamis, EDC Debit, dan Split Bill per item");

  autoTable(doc, {
    startY: curY,
    head: [["Metode Bayar", "Langkah Pelaksanaan di Kasir", "Perangkat & Hasil Struk"]],
    body: [
      ["TUNAI (CASH)", "Masukkan uang tunai yang diserahkan tamu -> Sistem otomatis hitung uang kembalian.", "Laci kasir terbuka via sinyal printer ESC/POS. Struk thermal terbit."],
      ["QRIS DINAMIS / STATIS", "Pilih QRIS -> Tamu scan barcode -> Kasir verifikasi notifikasi masuk di EDC/HP.", "Struk fisik tercetak + Opsi kirim PDF WhatsApp."],
      ["DEBIT / KARTU EDC", "Pilih EDC Card -> Masukkan nomor slip approval mesin EDC bank (BCA/Mandiri).", "Struk kasir diarsip bersama slip gesek EDC."],
      ["SPLIT BILL MEJA", "Buka Meja -> Klik 'Split Bill' -> Pilih 'Pecah Menu' atau 'Bagi Rata' -> Selesaikan pembayaran 1 -> Selesaikan tagihan 2.", "Terbit 2 struk terpisah tanpa selisih desimal Rp."]
    ],
    theme: "grid",
    headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 6.8 },
    bodyStyles: { fontSize: 6.2, textColor: TEXT_DARK as any, cellPadding: 1.8 },
    columnStyles: {
      0: { cellWidth: 38, fontStyle: "bold" },
      1: { cellWidth: 88 },
      2: { cellWidth: 56, textColor: [4, 120, 87] },
    },
    margin: { left: margin, right: margin },
  });

  curY = (doc as any).lastAutoTable.finalY + 6;
  curY = addSectionTitle(doc, "Studi Kasus Split Bill Meja 06 (QRIS & Tunai)", curY, "Simulasi tagihan Rp 95.000 dipecah menjadi 2 pembayaran berbeda");

  drawCaseStudyBox(
    doc,
    margin,
    curY,
    contentWidth,
    "Simulasi Split Bill Tagihan Rp 95.000 Dibagi 2 Orang",
    "Tamu A ingin membayar 2 Kopi miliknya (Rp 44.000) via QRIS, Tamu B membayar makanan Rp 51.000 via Tunai.",
    [
      "Buka Meja 06 di POS -> Klik tombol 'Split Bill'.",
      "Pilih 'Pecah Per Item' -> Centang 2 Kopi Susu Aren (Rp 44.000) -> Klik 'Bayar Tagihan Terpilih'.",
      "Pilih metode QRIS -> Transaksi pertama lunas dan struk tercetak.",
      "Sisa tagihan Meja 06 otomatis tersisa Rp 51.000. Kasir klik 'Bayar Sisa Meja' -> pilih CASH -> input Rp 100.000 -> kembalian Rp 49.000."
    ],
    "Meja 06 tertutup sempurna dengan 2 bukti pembayaran sah tanpa selisih uang."
  );

  // ════════════════════════════════════════════════════════════════════════════
  // HALAMAN 6: BAB 4 - OTORISASI SUPERVISOR, VOID & REFUND
  // ════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  addHeaderFooter(doc, 6, totalPages, "5. OTORISASI VOID & REFUND");

  curY = addSectionTitle(doc, "Otorisasi Supervisor PIN (Anti-Fraud Control)", 18, "Kasir tidak bisa membatalkan pesanan sepihak. Wajib verifikasi fisik Manager/Leader");

  autoTable(doc, {
    startY: curY,
    head: [["Aksi Sensitif Kasir", "Syarat Otorisasi", "Dampak pada Stok Bahan Gudang", "Dampak Finansial"]],
    body: [
      ["Void Item (Sebelum Bayar)", "Kasir dapat menghapus item langsung.", "Stok belum terpotong di sistem gudang.", "Subtotal nota berkurang."],
      ["Void Pesanan (Nota Terbit)", "Wajib PIN MANAGER, LEADER, atau SUPER_ADMIN.", "BAHAN BAKU OTOMATIS KEMBALI KE GUDANG.", "Omzet kotor nota tersebut dibatalkan."],
      ["Refund Pembayaran Tamu", "Wajib PIN MANAGER & alasan pembatalan sah.", "Bahan tidak kembali jika makanan sudah dibuat.", "Uang tunai kasir berkurang untuk refund."]
    ],
    theme: "grid",
    headStyles: { fillColor: [180, 83, 9], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 6.8 },
    bodyStyles: { fontSize: 6.2, textColor: TEXT_DARK as any, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 40, fontStyle: "bold" },
      1: { cellWidth: 50 },
      2: { cellWidth: 54, textColor: [4, 120, 87] },
      3: { cellWidth: 38, textColor: [185, 28, 28] },
    },
    margin: { left: margin, right: margin },
  });

  curY = (doc as any).lastAutoTable.finalY + 6;
  curY = addSectionTitle(doc, "Studi Kasus Pembatalan Nota Salah Input #JC-202610-0089", curY, "Langkah resmi pembatalan pesanan di POS dengan pendampingan Leader Bar");

  drawCaseStudyBox(
    doc,
    margin,
    curY,
    contentWidth,
    "Pembatalan Nota Karena Tamu Salah Sebut Menu Minuman",
    "Kasir menginput 3 cup 'Caramel Macchiato' dan nota sudah terlanjur dicetak. Tamu menyatakan mereka sebenarnya memesan 'Cafe Latte'.",
    [
      "Kasir membuka menu 'Riwayat Transaksi' di POS -> Cari nomor nota #JC-202610-0089.",
      "Klik tombol merah 'Void Pesanan'. Layar memunculkan pop-up 'Otorisasi Supervisor Diperlukan'.",
      "Leader Bar (Rama) mendekati meja kasir, mengetikkan PIN supervisor miliknya, dan memilih alasan: 'Salah Input Menu Kasir'.",
      "Kasir membuatkan nota baru yang benar (3 Cafe Latte). Minuman salah input ditangani sesuai SOP waste."
    ],
    "Nota lama ditandai [VOID]. Audit log mencatat nama Leader Rama sebagai pemberi wewenang dan stok biji kopi/susu dikembalikan secara presisi."
  );

  // ════════════════════════════════════════════════════════════════════════════
  // HALAMAN 7: BAB 5 - KITCHEN DISPLAY SYSTEM (KDS) MULTI-STATION
  // ════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  addHeaderFooter(doc, 7, totalPages, "6. KITCHEN DISPLAY SYSTEM");

  curY = addSectionTitle(doc, "Kitchen Display System (/kds)", 18, "Antarmuka tanpa kertas (paperless) untuk efisiensi peracikan Barista, Kitchen & Bakery");

  const kdsSplitY = curY;
  drawImageBox(doc, SCREEN_KDS, margin, kdsSplitY, colW + 6, 52, "Gambar 5.1: Layar Antrean KDS Tablet Stasiun Barista & Dapur");

  doc.setFontSize(7.2);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2]);
  doc.text("Arti Warna Tiket pada Layar KDS:", descX, kdsSplitY + 4);

  const kdsBadges = [
    { title: "MERAH / KUNING (Antrean Masuk):", desc: "Pesanan baru saja dikirim oleh kasir. Belum disentuh staf peracik." },
    { title: "ORANYE (Sedang Dibuat / Cooking):", desc: "Barista / Chef menyentuh kartu tanda mulai meracik atau memasak pesanan." },
    { title: "HIJAU (Siap Antar / Ready to Serve):", desc: "Pesanan selesai diracik. Notifikasi berbunyi agar waiter mengambil ke meja." },
    { title: "SELESAI (Completed):", desc: "Pesanan telah disajikan ke tamu. Otomatis hilang dari layar dalam 10 detik." },
  ];

  kdsBadges.forEach((b, idx) => {
    const by = kdsSplitY + 9 + idx * 10.5;
    doc.setFontSize(6.2);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2]);
    doc.text(b.title, descX, by);

    doc.setFontSize(5.8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
    const lines = doc.splitTextToSize(b.desc, descW);
    doc.text(lines, descX, by + 4);
  });

  curY = kdsSplitY + 59;
  curY = addSectionTitle(doc, "Standar Waktu Penyajian Pesanan (SLA Service Time)", curY, "Target durasi waktu pembuatan pesanan Julia's Coffee");

  autoTable(doc, {
    startY: curY,
    head: [["Kategori Menu", "Stasiun Pelaksana", "Target Standar", "Tindakan Jika Terlambat"]],
    body: [
      ["Espresso & Kopi Susu Dingin", "Barista (Stasiun Bar)", "Maksimal 3 - 5 Menit", "Barista kedua membantu membagi susu & shot."],
      ["Manual Brew (V60 / Japanese)", "Leader / Senior Barista", "Maksimal 7 - 9 Menit", "Kasir menginfokan bahwa manual brew diseduh perlahan."],
      ["Makanan Hangat (Kitchen)", "Chef Dapur (Kitchen)", "Maksimal 12 - 15 Menit", "Jika >15 menit, kartu KDS berkedip merah (Alert Lambat)."],
      ["Pastry & Croissant Display", "Baker / Waiter", "Maksimal 2 - 4 Menit", "Hangatkan oven toaster 2 menit, langsung antar ke meja."]
    ],
    theme: "grid",
    headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 6.8 },
    bodyStyles: { fontSize: 6.2, textColor: TEXT_DARK as any, cellPadding: 1.5 },
    columnStyles: {
      0: { cellWidth: 46, fontStyle: "bold" },
      1: { cellWidth: 38 },
      2: { cellWidth: 32, fontStyle: "bold", textColor: [4, 120, 87] },
      3: { cellWidth: 66 },
    },
    margin: { left: margin, right: margin },
  });

  // ════════════════════════════════════════════════════════════════════════════
  // HALAMAN 8: BAB 6 - PERAN LEADER BAR: CHECKLIST, KALIBRASI & WASTE
  // ════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  addHeaderFooter(doc, 8, totalPages, "7. PERAN LEADER BAR");

  curY = addSectionTitle(doc, "Peran LEADER: Supervisi Bar & Checklist Harian", 18, "Tanggung jawab teknis menjaga mutu espresso, kebersihan bar, dan kontrol waste");

  const ldrSplitY = curY;
  drawImageBox(doc, SCREEN_LEADER, margin, ldrSplitY, colW + 6, 52, "Gambar 6.1: Layar Checklist Supervisi Stasiun Bar");

  doc.setFontSize(7.2);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2]);
  doc.text("Tugas Harian Leader Bar (Rama):", descX, ldrSplitY + 4);

  const ldrTasks = [
    "• Checklist Opening Bar: Memeriksa kebersihan mesin, boiler, grinder hopper, ketersediaan cup, dan suhu chiller susu.",
    "• Kalibrasi Espresso Pagi: Melakukan dial-in grinder (18g dose / 36g yield / 27 detik) sebelum kedai dibuka.",
    "• Pencatatan Waste Barista: Menginput gramatur kopi terbuang saat dialing atau susu tumpah via tombol 'Kalibrasi & Waste' di POS.",
    "• Otorisasi Pendampingan Kasir: Memberikan PIN otorisasi saat kasir butuh void atau diskon.",
    "• Supervisi Stok Bar: Menimbang sisa biji kopi & susu saat stok opname mingguan."
  ];
  ldrTasks.forEach((lt, idx) => {
    const l = doc.splitTextToSize(lt, descW);
    doc.text(l, descX, ldrSplitY + 9 + idx * 7.5);
  });

  curY = ldrSplitY + 59;
  curY = addSectionTitle(doc, "Studi Kasus Kalibrasi Dial-In 36g & Susu Pecah 200ml", curY, "Pencatatan resmi agar biaya HPP tidak bocor");

  drawCaseStudyBox(
    doc,
    margin,
    curY,
    contentWidth,
    "Pencatatan Dial-In Pagi 36g Kopi & Susu Pecah 200ml",
    "Barista Budi melakukan dialing pagi: 2 shot espresso dibuang (total 36 gram biji kopi). Pukul 15:00, 200ml susu pecah di steam wand.",
    [
      "Buka menu POS -> Klik ikon cangkir 'Kalibrasi & Waste' di sudut atas layar kasir.",
      "Pilih bahan: 'House Blend Espresso Beans' -> Masukkan gramatur: 36 gr -> Pilih alasan: 'Kalibrasi Espresso Dial-In Pagi'.",
      "Klik simpan. Lakukan input kedua untuk 'Fresh Milk Greenfields' -> Masukkan: 200 ml -> Pilih alasan: 'Kerusakan / Human Error'."
    ],
    "Stok biji kopi terpotong 36g (HPP Rp 9.000) dan susu terpotong 200ml (HPP Rp 3.700). Kerugian tercatat resmi di Laporan Biaya Waste Bulanan."
  );

  // ════════════════════════════════════════════════════════════════════════════
  // HALAMAN 9: BAB 7 - TUTUP SHIFT KASIR & REKONSILIASI Z-REPORT
  // ════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  addHeaderFooter(doc, 9, totalPages, "8. TUTUP SHIFT KASIR");

  curY = addSectionTitle(doc, "Prosedur Tutup Shift Kasir Malam (Z-Report)", 18, "Pukul 22:30 WITA: Rekonsiliasi fisik uang laci disaksikan bersama Leader Bar");

  autoTable(doc, {
    startY: curY,
    head: [["Komponen Kas Laci", "Rumus Sistem POS", "Tindakan Jika Terjadi Selisih"]],
    body: [
      ["Saldo Diharapkan di Laci", "Modal Awal + Penjualan Tunai - Pengeluaran Kas Kasir", "Dihitung otomatis dari seluruh struk tunai yang terbit."],
      ["Uang Fisik Aktual di Laci", "Total lembaran uang & koin yang dihitung fisik saat itu", "Kasir dan Leader wajib menghitung fisik bersama 2 kali."],
      ["Selisih Kas Lunas (Rp 0)", "Uang Fisik Aktual = Saldo Kas Diharapkan", "Kondisi seimbang sempurna. Cetak slip Z-Report lunas."],
      ["Selisih Kurang (-Rp)", "Uang Fisik Aktual < Saldo Kas Diharapkan", "Investigasi kuitansi kasbon/petty cash kasir yang belum diinput."],
      ["Selisih Lebih (+Rp)", "Uang Fisik Aktual > Saldo Kas Diharapkan", "Catat sebagai 'Kas Lebih' (cek kembalian tamu yang tertinggal)."]
    ],
    theme: "grid",
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 6.8 },
    bodyStyles: { fontSize: 6.2, textColor: TEXT_DARK as any, cellPadding: 1.8 },
    columnStyles: {
      0: { cellWidth: 46, fontStyle: "bold" },
      1: { cellWidth: 70 },
      2: { cellWidth: 66, textColor: [180, 83, 9] },
    },
    margin: { left: margin, right: margin },
  });

  curY = (doc as any).lastAutoTable.finalY + 6;
  curY = addSectionTitle(doc, "Studi Kasus Penutupan Kasir dengan Selisih Kurang -Rp 10.000", curY, "Langkah resmi pencatatan uang laci kasir saat tidak seimbang");

  drawCaseStudyBox(
    doc,
    margin,
    curY,
    contentWidth,
    "Penutupan Shift Kasir Malam: Uang Fisik Kurang Rp 10.000",
    "Pukul 22:30 WITA, kasir menutup shift. Modal awal Rp 300.000, omzet tunai Rp 1.250.000 (Target sistem: Rp 1.550.000). Saat dihitung fisik, uang hanya ada Rp 1.540.000 (Kurang Rp 10.000).",
    [
      "Kasir dan Leader Bar menghitung ulang uang laci 2 kali untuk memastikan tidak ada lembaran terselip di bawah tray.",
      "Pada layar 'Tutup Shift', kasir mengetikkan angka fisik sebenarnya: Rp 1.540.000.",
      "Sistem memunculkan teks merah: 'SELISIH KURANG: -Rp 10.000'.",
      "Kasir mengisi kolom keterangan: 'Kurang Rp 10.000, kemungkinan salah kembalian saat jam ramai 20:00'. Leader memasukkan PIN verifikasi dan klik 'Cetak Slip Z-Report'."
    ],
    "Shift resmi tertutup dan transaksi hari itu terkunci. Selisih -Rp 10.000 tercatat di Rekap Audit Shift dan uang fisik Rp 1.540.000 diserahkan ke brankas."
  );

  // ════════════════════════════════════════════════════════════════════════════
  // HALAMAN 10: BAB 8 - INVENTORI RESEP (BOM) & AUDIT STOK OPNAME
  // ════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  addHeaderFooter(doc, 10, totalPages, "9. INVENTORI & RESEP HPP");

  curY = addSectionTitle(doc, "Inventori, Resep Otomatis (BOM) & Analisis HPP", 18, "Pengendalian biaya bahan baku (COGS) dan proteksi kebocoran persediaan");

  const invSplitY = curY;
  drawImageBox(doc, SCREEN_INVENTORY, margin + colW + 4, invSplitY, colW - 4, 52, "Gambar 8.1: Layar Manajemen Stok & Resep Menu");

  autoTable(doc, {
    startY: invSplitY,
    head: [["Menu Kopi & Eatery", "Takaran Bahan (BOM)", "Biaya HPP Satuan"]],
    body: [
      ["Kopi Susu Aren", "18g Espresso Beans\n120ml Susu Greenfields\n25ml Aren Cair\n120g Es Batu Tube", "Rp 6.850 / cup\n(Jual: Rp 22.000)\nMargin: 68.8%"],
      ["Americano Iced", "18g Espresso Beans\n150ml Air RO Bersih\n150g Es Batu Crystal", "Rp 4.750 / cup\n(Jual: Rp 18.000)\nMargin: 73.6%"],
      ["Nasi Goreng Special", "150g Beras Pulen\n1 Butir Telur Ayam\n50g Suwir Ayam\nPorsi Bumbu Racik", "Rp 11.500 / porsi\n(Jual: Rp 32.000)\nMargin: 64.0%"]
    ],
    theme: "grid",
    headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 6.2 },
    bodyStyles: { fontSize: 5.8, textColor: TEXT_DARK as any, cellPadding: 1.5 },
    columnStyles: {
      0: { cellWidth: 26, fontStyle: "bold" },
      1: { cellWidth: 36 },
      2: { cellWidth: 24, textColor: [4, 120, 87], fontStyle: "bold" },
    },
    margin: { left: margin, right: margin + colW + 4 },
  });

  curY = invSplitY + 59;
  curY = addSectionTitle(doc, "Studi Kasus Audit Stok Opname Mingguan (-150g Biji Kopi)", curY, "Penyesuaian saldo gudang dan deteksi dini kebocoran bahan");

  drawCaseStudyBox(
    doc,
    margin,
    curY,
    contentWidth,
    "Audit Stok Opname Mingguan: Biji Kopi Selisih Minus 150 Gram",
    "Leader Bar menimbang toples biji kopi sisa di bar. Timbangan menunjukkan 2.850 gram, sedangkan di sistem mencatat 3.000 gram (selisih minus 150 gram).",
    [
      "Buka menu 'Inventori' -> Tab 'Stok Opname' -> Klik 'Mulai Sesi Opname'.",
      "Ketik angka timbangan riil: 2850 pada kolom 'Stok Fisik Aktual' biji kopi house blend.",
      "Sistem menghitung otomatis: Selisih = 2.850 - 3.000 = -150 gr. Defisit Rupiah = 150 gr x Rp 250/gr = -Rp 37.500.",
      "Manager mengisi catatan: 'Selisih wajar kalibrasi harian dan residual grinder'. Klik 'Finalisasi Koreksi Stok'."
    ],
    "Kartu stok otomatis terkoreksi menjadi 2.850 gram dan nilai defisit Rp 37.500 masuk ke Jurnal Penyesuaian HPP tanpa merusak saldo kas."
  );

  // ════════════════════════════════════════════════════════════════════════════
  // HALAMAN 11: BAB 9 - PERAN FINANCE: BUKU KAS, PETTY CASH & BANK
  // ════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  addHeaderFooter(doc, 11, totalPages, "10. PERAN FINANCE & ARUS KAS");

  curY = addSectionTitle(doc, "Peran FINANCE: Buku Kas, Petty Cash & Rekonsiliasi Bank", 18, "Tanggung jawab pembukuan kas masuk/keluar, kas kecil, dan mutasi rekening");

  const finSplitY = curY;
  drawImageBox(doc, SCREEN_CASHFLOW, margin, finSplitY, colW + 6, 52, "Gambar 9.1: Layar Buku Kas & Arus Kas Julia's Coffee");

  doc.setFontSize(7.2);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2]);
  doc.text("Tugas Utama Bagian Finance:", descX, finSplitY + 4);

  const finTasks = [
    "• Monitoring Kas Masuk: Memastikan setoran tunai kasir malam cocok dengan laporan Z-Report.",
    "• Rekonsiliasi QRIS & EDC: Mencocokkan saldo settlement payment gateway dengan mutasi rekening bank BCA/Mandiri.",
    "• Pengendalian Kas Kecil (Petty Cash): Memverifikasi pengeluaran operasional darurat (es batu, galon air, gas, pembersih).",
    "• Pembayaran Supplier PO: Mencatat pelunasan faktur pembelian bahan baku biji kopi & susu.",
    "• Verifikasi Payroll: Memeriksa kalkulasi gaji, lembur, dan potongan kasbon sebelum slip gaji terbit."
  ];
  finTasks.forEach((ft, idx) => {
    const l = doc.splitTextToSize(ft, descW);
    doc.text(l, descX, finSplitY + 9 + idx * 7.5);
  });

  curY = finSplitY + 59;
  curY = addSectionTitle(doc, "Studi Kasus Pembelian Es Batu Darurat Rp 25.000 via Kas Kecil", curY, "Pencatatan resmi biaya operasional darurat di kasir");

  drawCaseStudyBox(
    doc,
    margin,
    curY,
    contentWidth,
    "Pembelian Es Batu Darurat Rp 25.000 via Kas Kecil",
    "Mesin es batu pendinginan di jam sibuk. Kasir mengambil uang tunai laci Rp 25.000 untuk membeli 5 kantong es kristal di warung terdekat.",
    [
      "Buka menu Kas & Biaya -> Klik 'Catat Pengeluaran Petty Cash'.",
      "Pilih kategori: 'Operasional Harian - Es Batu' -> Masukkan nominal: Rp 25.000.",
      "Ketik keterangan: 'Beli es batu darurat 5 pack karena kompresor mesin es pendinginan'.",
      "Ambil uang tunai dari laci kasir -> Simpan struk pembelian fisik di map nota kasir."
    ],
    "Uang kas di laci kasir berkurang Rp 25.000 secara sah dan laporan kas malam otomatis memperhitungkan pengeluaran ini tanpa selisih."
  );

  // ════════════════════════════════════════════════════════════════════════════
  // HALAMAN 12: BAB 10 - SDM & PENGGAJIAN (PAYROLL)
  // ════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  addHeaderFooter(doc, 12, totalPages, "11. SDM & PAYROLL");

  curY = addSectionTitle(doc, "SDM, Presensi GPS Selfie & Penggajian (Payroll)", 18, "Manajemen kedisiplinan kerja dan penggajian transparan otomatis");

  const paySplitY = curY;
  drawImageBox(doc, SCREEN_PAYROLL, margin + colW + 4, paySplitY, colW - 4, 52, "Gambar 10.1: Layar Manajemen Payroll & Slip Gaji");

  doc.setFontSize(7.2);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2]);
  doc.text("Komponen Gaji Karyawan Julia's:", margin, paySplitY + 4);

  const payDescW = colW;
  const payPoints = [
    "• Integrasi Presensi GPS: Gaji harian dihitung dari jam Clock-In sah di dalam radius kedai.",
    "• Perhitungan Lembur: Jam lembur terverifikasi dikalikan tarif upah lembur per jam.",
    "• Bonus Target Omzet: Insentif performa jika omzet bulanan kedai melampaui target.",
    "• Potongan Kasbon: Pengurangan otomatis cicilan pinjaman staf secara transparan.",
    "• Cetak Slip Gaji PDF: Sekali klik terbit berkas resmi siap kirim via WhatsApp."
  ];
  payPoints.forEach((p, idx) => {
    const l = doc.splitTextToSize(p, payDescW);
    doc.text(l, margin, paySplitY + 9 + idx * 7.5);
  });

  curY = paySplitY + 59;
  curY = addSectionTitle(doc, "Studi Kasus Penggajian Barista Budi (Periode Bulan Berjalan)", curY, "Simulasi penerbitan slip gaji digital resmi");

  drawCaseStudyBox(
    doc,
    margin,
    curY,
    contentWidth,
    "Penerbitan Slip Gaji Barista Budi Lengkap dengan Bonus Omzet",
    "Budi memiliki 26 hari kehadiran sah, 6 jam lembur saat event akhir pekan, dan berhak atas bonus omzet Rp 200.000.",
    [
      "Buka menu 'Payroll' -> Pilih periode bulan penggajian.",
      "Periksa rekap kehadiran Budi (26 hari masuk, 6 jam lembur terverifikasi Manager).",
      "Sistem mengalkulasi otomatis: Gaji Pokok + Uang Makan + Lembur + Bonus = Rp 3.250.000.",
      "Manager/Finance klik 'Generate Slip Gaji PDF' -> Unduh dokumen dan kirimkan via WhatsApp pribadi Budi."
    ],
    "Dokumen PDF resmi diterbitkan lengkap dengan logo Julia's Coffee, rincian potongan transparan, dan tanda terima digital sah."
  );

  // ════════════════════════════════════════════════════════════════════════════
  // HALAMAN 13: BAB 11 - DASHBOARD OWNER & PROTOKOL RESET AMAN
  // ════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  addHeaderFooter(doc, 13, totalPages, "12. DASHBOARD OWNER & RESET");

  curY = addSectionTitle(doc, "Dashboard Eksekutif Owner & Protokol Reset Data Uji Coba", 18, "Pengawasan kesehatan finansial P&L dan pembersihan transaksi dummy sebelum go-live");

  const dashSplitY = curY;
  drawImageBox(doc, SCREEN_DASHBOARD, margin, dashSplitY, colW + 6, 52, "Gambar 11.1: Dashboard Eksekutif Owner & KPI Toko");

  doc.setFontSize(7.2);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2]);
  doc.text("Standar Rasio Finansial Sehat:", descX, dashSplitY + 4);

  const dashRatios = [
    "• Gross Sales: Total penjualan kotor sebelum diskon promo.",
    "• Net Sales: Omzet bersih yang masuk dari pelanggan setelah diskon.",
    "• COGS / HPP Bahan: Biaya bahan baku yang terpotong otomatis dari resep.",
    "  -> Standar Sehat Kedai Julia's: 28% s/d 35% dari Net Sales. Jika >38%, audit porsi!",
    "• Gross Profit: Laba kotor kedai (Target Sehat: 65% - 72%).",
    "• Net Profit Margin: Laba bersih akhir pemilik kedai (Target: 20% - 30%)."
  ];
  dashRatios.forEach((dr, idx) => {
    const l = doc.splitTextToSize(dr, descW);
    doc.text(l, descX, dashSplitY + 9 + idx * 6.5);
  });

  curY = dashSplitY + 59;
  curY = addSectionTitle(doc, "Protokol 3-Lapis Reset Data Uji Coba Sebelum Go-Live", curY, "Langkah resmi membersihkan transaksi training tanpa merusak master data");

  drawCaseStudyBox(
    doc,
    margin,
    curY,
    contentWidth,
    "Prosedur Pembersihan Data Transaksi Uji Coba oleh Super Admin",
    "Setelah tim selesai melakukan training simulasi aplikasi di awal bulan depan, seluruh transaksi dummy harus dibersihkan agar sistem mulai dari angka 0 pada hari peluncuran resmi.",
    [
      "Login sebagai Super Admin (username: 'admin') -> Buka menu 'Pengaturan' -> Submenu 'Pemeliharaan Database'.",
      "Pada panel 'Reset Transaksi Uji Coba', masukkan PIN Super Admin yang sah.",
      "Ketikkan teks konfirmasi wajib persis: 'HAPUS DATA UJI COBA' untuk membuka kunci pengaman.",
      "Klik tombol merah 'Mulai Bersihkan Riwayat Transaksi'."
    ],
    "Seluruh order dummy dan shift kasir dibersihkan 100% kembali ke 0. DAFTAR MENU, HARGA, RESEP, STOK GUDANG, DAN 9 AKUN USER TETAP AMAN UTUH."
  );

  // ════════════════════════════════════════════════════════════════════════════
  // HALAMAN 14: BAB 12 - PUSAT EKSPOR LAPORAN & FAQ TROUBLESHOOTING
  // ════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  addHeaderFooter(doc, 14, totalPages, "13. EKSPOR LAPORAN & FAQ");

  curY = addSectionTitle(doc, "Pusat Ekspor & Laporan Bisnis Eksekutif", 18, "Laporan terpadu siap cetak dan olah data untuk akuntan, owner & investor");

  const exportTable = [
    ["👑 Laporan Master (All-in-One)", "Excel .xlsx (7 Sheet Mandiri)", "Menghasilkan 1 file Excel memuat: Ringkasan Eksekutif, Penjualan, Arus Kas, Inventori Stok, Slip Payroll, Log Absensi, dan Skor KPI."],
    ["👑 Laporan Eksekutif Master", "Berkas PDF Siap Cetak", "Ringkasan metrik finansial, omzet kotor, penjualan bersih, kas operasional, laba bersih, dan aset persediaan tanpa teks bertumpuk."],
    ["Laporan Penjualan (Sales)", "PDF & CSV", "Rincian struk per produk, quantity terjual, omzet harian/bulanan, dan metode bayar."],
    ["Laporan Stok Bahan Baku", "PDF & CSV", "Daftar saldo stok sisa, harga rata-rata, dan total nilai aset persediaan kafe."],
    ["Laporan Arus Kas (Cash Flow)", "PDF & CSV", "Daftar pemasukan & pengeluaran berdasarkan kategori beban usaha."],
  ];

  autoTable(doc, {
    startY: curY,
    head: [["Jenis Laporan", "Format File", "Cakupan Data & Kegunaan"]],
    body: exportTable,
    theme: "striped",
    headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 6.8 },
    bodyStyles: { fontSize: 6.2, textColor: [51, 65, 85], cellPadding: 1.8 },
    columnStyles: {
      0: { cellWidth: 46, fontStyle: "bold" },
      1: { cellWidth: 38, fontStyle: "bold", textColor: [15, 118, 110] },
      2: { cellWidth: 98 },
    },
    margin: { left: margin, right: margin },
  });

  const faqY = (doc as any).lastAutoTable.finalY + 6;
  curY = addSectionTitle(doc, "Standar Operasional (SOP) Penanganan Kendala (FAQ)", faqY, "Solusi cepat penanganan kendala teknis di lapangan kedai");

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
    {
      q: "4. Bagaimana jika seorang staf lupa PIN atau ingin mengganti PIN?",
      a: "Staf melapor ke Manager Operasional atau Super Admin. Manager membuka menu [Sistem & Admin] -> [Manajemen Pengguna] -> Edit Pengguna -> Ketik 4-6 digit PIN baru -> Simpan. Staf tidak bisa ganti PIN sendiri demi audit trail.",
    },
  ];

  autoTable(doc, {
    startY: curY,
    head: [["Pertanyaan / Situasi Kendala", "Langkah Penyelesaian SOP Lapangan"]],
    body: faqs.map((f) => [f.q, f.a]),
    theme: "grid",
    headStyles: { fillColor: [245, 158, 11], textColor: [15, 23, 42], fontStyle: "bold", fontSize: 6.8 },
    bodyStyles: { fontSize: 6.2, textColor: [51, 65, 85], cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 54, fontStyle: "bold" },
      1: { cellWidth: 128 },
    },
    margin: { left: margin, right: margin },
  });

  // End Box
  const endY = (doc as any).lastAutoTable.finalY + 5;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("— Dokumen Buku Panduan Pengguna Resmi Julia's Coffee & Eatery POS System —", pageWidth / 2, endY, { align: "center" });

  // Save to target outputs
  const outputPdfPath = path.resolve(process.cwd(), "public", "Buku_Panduan_Lengkap_Julia_Coffee.pdf");
  const buffer = Buffer.from(doc.output("arraybuffer"));
  fs.writeFileSync(outputPdfPath, buffer);
  console.log(`[Master Combined Manual] Successfully generated 14-page master manual: ${outputPdfPath} (${buffer.length} bytes)`);
};

// Execute
generateCombinedOfficialManual();
