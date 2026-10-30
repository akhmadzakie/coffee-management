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
const SCREEN_INVENTORY = loadBase64Image(path.join(process.cwd(), "public", "screenshots", "05_inventory_screen.png"));
const SCREEN_SHIFTS = loadBase64Image(path.join(process.cwd(), "public", "screenshots", "06_shifts_screen.png"));
const SCREEN_PAYROLL = loadBase64Image(path.join(process.cwd(), "public", "screenshots", "07_payroll_screen.png"));
const SCREEN_SETTINGS = loadBase64Image(path.join(process.cwd(), "public", "screenshots", "08_settings_screen.png"));

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
const drawPageHeader = (doc: any, chapterTitle: string, category: string) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  doc.setFillColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2]);
  doc.rect(0, 0, pageWidth, 13.5, "F");
  doc.setFillColor(BRAND_AMBER[0], BRAND_AMBER[1], BRAND_AMBER[2]);
  doc.rect(0, 12.8, pageWidth, 0.7, "F");

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(chapterTitle.toUpperCase(), margin, 9);

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(BRAND_AMBER[0], BRAND_AMBER[1], BRAND_AMBER[2]);
  doc.text(category, pageWidth - margin, 9, { align: "right" });
};

// Helper for page footer
const drawPageFooter = (doc: any, pageNo: number, totalPages: number) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  doc.setDrawColor(BORDER_LIGHT[0], BORDER_LIGHT[1], BORDER_LIGHT[2]);
  doc.line(margin, pageHeight - 9, pageWidth - margin, pageHeight - 9);

  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
  doc.text(
    `Halaman ${pageNo} dari ${totalPages}  •  Buku Panduan Lengkap Julia's Coffee & Eatery  •  Dokumen Resmi Internal`,
    margin,
    pageHeight - 5
  );
  doc.text("Kerahasiaan Terkendali  •  Versi 2.4.0", pageWidth - margin, pageHeight - 5, {
    align: "right",
  });
};

// Helper for section header
const drawSectionHeader = (doc: any, y: number, title: string, subtitle?: string) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  doc.setFillColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2]);
  doc.rect(margin, y, contentWidth, 6.5, "F");
  doc.setFillColor(BRAND_AMBER[0], BRAND_AMBER[1], BRAND_AMBER[2]);
  doc.rect(margin, y, 2.5, 6.5, "F");

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(title.toUpperCase(), margin + 5, y + 4.6);

  if (subtitle) {
    doc.setFontSize(6.8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
    doc.text(subtitle, margin, y + 10.5);
    return y + 13.5;
  }
  return y + 9;
};

// Helper to draw an image box with neat device border and caption
const drawImageBox = (
  doc: any,
  imgBase64: string,
  x: number,
  y: number,
  w: number,
  h: number,
  caption: string
) => {
  // Device Frame
  doc.setFillColor(BG_LIGHT[0], BG_LIGHT[1], BG_LIGHT[2]);
  doc.setDrawColor(BORDER_LIGHT[0], BORDER_LIGHT[1], BORDER_LIGHT[2]);
  doc.roundedRect(x - 1, y - 1, w + 2, h + 7, 1.5, 1.5, "FD");

  if (imgBase64) {
    try {
      doc.addImage(imgBase64, "PNG", x, y, w, h);
    } catch (e) {
      console.warn("Failed to embed image:", e);
    }
  }

  // Caption Bar
  doc.setFontSize(5.8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
  doc.text(caption, x + w / 2, y + h + 4.2, { align: "center" });

  return y + h + 9;
};

// Helper to draw Case Study Box (Kotak Contoh Nyata)
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
  doc.setFillColor(254, 252, 232); // amber-50
  doc.setDrawColor(245, 158, 11);  // amber-500
  doc.roundedRect(x, y, w, 44, 1.5, 1.5, "FD");

  // Badge Header
  doc.setFillColor(245, 158, 11);
  doc.roundedRect(x + 2.5, y + 2.5, 36, 4, 0.8, 0.8, "F");
  doc.setFontSize(5.8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("CONTOH KASUS OPERASIONAL", x + 4, y + 5.2);

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(146, 64, 14);
  doc.text(title, x + 41, y + 5.4);

  // Scenario
  doc.setFontSize(6.2);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Skenario:", x + 3.5, y + 10.5);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 41, 59);
  const scLines = doc.splitTextToSize(scenario, w - 22);
  doc.text(scLines.slice(0, 2), x + 18, y + 10.5);

  // Steps
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Langkah:", x + 3.5, y + 18.5);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 41, 59);
  let stepY = y + 18.5;
  steps.forEach((st, idx) => {
    const lines = doc.splitTextToSize(`${idx + 1}. ${st}`, w - 22);
    doc.text(lines[0], x + 18, stepY);
    stepY += 3.8;
  });

  // Result Banner
  doc.setFillColor(240, 253, 244); // emerald-50
  doc.setDrawColor(52, 211, 153);  // emerald-400
  doc.roundedRect(x + 2.5, y + 34, w - 5, 7.5, 1, 1, "FD");

  doc.setFontSize(6);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(6, 95, 70);
  doc.text("Hasil Sistem:", x + 5, y + 38.5);

  doc.setFont("helvetica", "normal");
  doc.text(result, x + 23, y + 38.5);

  return y + 47;
};

// ============================================================================
// GENERATE COMPREHENSIVE 12-PAGE MANUAL BOOK
// ============================================================================
export const generateDetailedManualBook = () => {
  const doc = new JsPDFConstructor("p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const totalPages = 12;

  console.log("Building Comprehensive 12-Page Manual Book with Real Screenshots...");

  // ════════════════════════════════════════════════════════════════════════════
  // HALAMAN 1: COVER ELEGAN & IDENTITAS RESMI
  // ════════════════════════════════════════════════════════════════════════════
  doc.setFillColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2]);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  // Accent Lines
  doc.setFillColor(BRAND_AMBER[0], BRAND_AMBER[1], BRAND_AMBER[2]);
  doc.rect(margin, 28, 4, 38, "F");

  // Logo
  if (LOGO_IMG) {
    try {
      doc.addImage(LOGO_IMG, "PNG", pageWidth - margin - 35, 26, 35, 35);
    } catch {}
  }

  // Cover Titles
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("JULIA'S COFFEE & EATERY", margin + 8, 38);

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BRAND_AMBER[0], BRAND_AMBER[1], BRAND_AMBER[2]);
  doc.text("BUKU PANDUAN LENGKAP & STANDAR OPERASIONAL (SOP)", margin + 8, 48);

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(203, 213, 225);
  doc.text("Petunjuk Rinci Alur Kerja, Tangkapan Layar Asli, Pembahasan Fitur & Studi Kasus Operasional", margin + 8, 56);

  // Metadata Card
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(margin, 75, contentWidth, 24, 2, 2, "F");

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BRAND_AMBER[0], BRAND_AMBER[1], BRAND_AMBER[2]);
  doc.text("INFORMASI DOKUMEN SISTEM:", margin + 5, 82);

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(255, 255, 255);
  doc.text("• Platform: Julia's Integrated POS & ERP Web System (PWA Hybrid Offline/Online)", margin + 5, 88);
  doc.text("• Edisi: November 2026  •  Versi Rilis: v2.4.0 (Production Ready)", margin + 5, 93);
  doc.text("• Sasaran Pengguna: Owner, Manager Operasional, Kasir, Leader Bar, Barista, Chef Kitchen, Baker, dan Finance", margin + 5, 98);

  // Daftar Isi Box
  doc.setFillColor(BG_LIGHT[0], BG_LIGHT[1], BG_LIGHT[2]);
  doc.roundedRect(margin, 106, contentWidth, 142, 2, 2, "F");

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2]);
  doc.text("DAFTAR ISI & STRUKTUR PEMBAHASAN BUKU PANDUAN", margin + 6, 115);

  const chapters = [
    { no: "BAB 01", title: "Struktur Organisasi, Hak Akses & Matriks 9 Role Akun Pengguna", hal: "Hal 02" },
    { no: "BAB 02", title: "Otentikasi Login, Presensi GPS Staf & Prosedur Buka Shift Kasir", hal: "Hal 03" },
    { no: "BAB 03", title: "Operasional Kasir POS: Katalog Menu, Pesanan Dine In Meja & Take Away", hal: "Hal 04" },
    { no: "BAB 04", title: "Alur Pembayaran Kasir, Split Bill (Pecah Tagihan) & Struk Thermal/WA", hal: "Hal 05" },
    { no: "BAB 05", title: "Otorisasi Supervisor, Pembatalan Pesanan (Void) & Penanganan Refund", hal: "Hal 06" },
    { no: "BAB 06", title: "Kitchen Display System (KDS): Antrean Stasiun Barista, Dapur & Pastry", hal: "Hal 07" },
    { no: "BAB 07", title: "Kalibrasi Espresso Barista, Pencatatan Waste & Pengendalian Bahan Rusak", hal: "Hal 08" },
    { no: "BAB 08", title: "Prosedur Tutup Shift Kasir Malam, Rekonsiliasi Kas Laci & Slip Z-Report", hal: "Hal 09" },
    { no: "BAB 09", title: "Manajemen Resep (BOM), Kartu Stok Bahan & Audit Stok Opname Mingguan", hal: "Hal 10" },
    { no: "BAB 10", title: "Pengadaan Bahan (PO Supplier), Kas Kecil (Petty Cash) & Penggajian (Payroll)", hal: "Hal 11" },
    { no: "BAB 11", title: "Dashboard Eksekutif Owner, Audit Trail & Protokol Reset Data Uji Coba", hal: "Hal 12" },
  ];

  chapters.forEach((ch, idx) => {
    const cy = 124 + idx * 10.8;
    doc.setFillColor(idx % 2 === 0 ? 241 : 255, idx % 2 === 0 ? 245 : 255, idx % 2 === 0 ? 249 : 255);
    doc.rect(margin + 4, cy - 3.5, contentWidth - 8, 8, "F");

    doc.setFontSize(7.2);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(ACCENT_BLUE[0], ACCENT_BLUE[1], ACCENT_BLUE[2]);
    doc.text(ch.no, margin + 7, cy + 1.5);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2]);
    doc.text(ch.title, margin + 26, cy + 1.5);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(BRAND_AMBER[0], BRAND_AMBER[1], BRAND_AMBER[2]);
    doc.text(ch.hal, margin + contentWidth - 12, cy + 1.5, { align: "right" });
  });

  // Footer Cover
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184);
  doc.text("Diterbitkan oleh Tim Manajemen & Teknis Julia's Coffee & Eatery  •  Hak Cipta Dilindungi", pageWidth / 2, pageHeight - 12, { align: "center" });

  // ════════════════════════════════════════════════════════════════════════════
  // HALAMAN 2: BAB 1 - STRUKTUR ORGANISASI & MATRIKS 9 ROLE
  // ════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  drawPageHeader(doc, "Bab 1: Struktur Organisasi & Matriks 9 Role", "Organisasi & Hak Akses");

  let curY = 18;
  curY = drawSectionHeader(
    doc,
    curY,
    "1. Pembagian Tugas & Tanggung Jawab Operasional Kedai",
    "Setiap personil memiliki wewenang khusus di aplikasi demi menjaga kepatuhan dan integritas data kas."
  );

  autoTable(doc, {
    startY: curY,
    head: [["Role / Peran", "Username", "Nama Personel", "Cakupan Hak Akses di Aplikasi", "Tanggung Jawab Fisik di Kedai"]],
    body: [
      ["SUPER_ADMIN", "admin", "Super Admin", "Akses 100% penuh: Database maintenance, audit log, konfigurasi toko, user.", "Bertanggung jawab atas kelancaran IT, koneksi jaringan, dan pemeliharaan server."],
      ["OWNER", "owner", "Owner Julia's", "Mode Eksekutif: Dashboard omzet, laba-rugi realtime, audit log, payroll.", "Pengawasan strategis bisnis, evaluasi laba kotor/bersih, dan keputusan investasi."],
      ["MANAGER", "manager", "Manager Operasional", "Otorisasi PIN Void/Refund, Approval Diskon, Pengadaan Bahan PO, HR & Jadwal.", "Memimpin operasional harian, kepuasan pelanggan, dan akurasi keuangan kedai."],
      ["KASIR", "kasir", "Terminal Kasir POS", "Buka/tutup shift kasir, transaksi meja, split bill, cetak nota thermal & WA.", "Melayani pemesanan pelanggan, menjaga akurasi uang tunai di laci, cetak Z-Report."],
      ["LEADER", "leader", "Rama (Leader Bar)", "Checklist bar, presensi tim, mutasi stok, kalibrasi espresso, stok opname bar.", "Menjaga kualitas rasa kopi, kebersihan stasiun bar, dan supervisi tim barista."],
      ["BAR", "barista", "Budi (Barista)", "Layar KDS Bar, ubah antrean minuman (Cooking/Done), presensi GPS.", "Mengekstraksi espresso, meracik mocktail/minuman sesuai resep gramatur."],
      ["KITCHEN", "kitchen", "Chef Dapur", "Layar KDS Kitchen, antrean makanan panas, porsi resep masakan, catat waste.", "Memasak hidangan dapur tepat waktu sesuai standar plating dan rasa."],
      ["BAKER", "baker", "Pastry Baker", "Layar KDS Pastry, antrean croissant & cake, stok showcase kue.", "Memanggang pastry, menjaga ketersediaan kue segar di display etalase."],
      ["FINANCE", "finance", "Finance & Accounting", "Buku kas operasional, petty cash, verifikasi pengeluaran belanja, payroll.", "Pencatatan akuntansi, rekonsiliasi transfer/QRIS dengan bank, dan pembayaran gaji."]
    ],
    theme: "grid",
    headStyles: { fillColor: BRAND_NAVY as any, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 6.5 },
    bodyStyles: { fontSize: 6, textColor: TEXT_DARK as any, cellPadding: 1.2 },
    columnStyles: {
      0: { cellWidth: 22, fontStyle: "bold" },
      1: { cellWidth: 16, fontStyle: "bold", textColor: ACCENT_BLUE as any },
      2: { cellWidth: 26 },
      3: { cellWidth: 64, textColor: [71, 85, 105] },
      4: { cellWidth: 54 },
    },
    margin: { left: margin, right: margin },
  });

  curY = (doc as any).lastAutoTable.finalY + 5;

  curY = drawSectionHeader(
    doc,
    curY,
    "2. Kebijakan Keamanan Kredensial & Larangan Berbagi PIN",
    "SOP Wajib Kepatuhan Seluruh Karyawan Julia's Coffee & Eatery"
  );

  doc.setFillColor(254, 242, 242);
  doc.setDrawColor(239, 68, 68);
  doc.roundedRect(margin, curY, contentWidth, 25, 1.5, 1.5, "FD");

  doc.setFontSize(7.2);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(153, 27, 27);
  doc.text("ATURAN MUTLAK KEAMANAN DIGITAL KEDAI:", margin + 3.5, curY + 5);

  doc.setFontSize(6.2);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(127, 29, 29);
  const securityRules = [
    "1. PIN bersifat pribadi dan rahasia. Dilarang keras memberitahukan PIN kepada rekan kerja lain apa pun alasannya.",
    "2. Setiap kali pembatalan pesanan (void) atau refund terjadi, sistem mencatat username pemilik PIN ke dalam audit trail yang tidak bisa dihapus.",
    "3. Apabila terjadi selisih kas atau kehilangan bahan baku, pertanggungjawaban akan ditujukan kepada username yang tercatat pada log sistem.",
    "4. Staf wajib segera mengganti PIN default (123456) saat pertama kali menerima akun melalui menu Pengaturan Profil masing-masing."
  ];
  securityRules.forEach((rule, idx) => {
    doc.text(rule, margin + 3.5, curY + 9.5 + idx * 3.8);
  });

  drawPageFooter(doc, 2, totalPages);

  // ════════════════════════════════════════════════════════════════════════════
  // HALAMAN 3: BAB 2 - LOGIN, PRESENSI & BUKA SHIFT KASIR
  // ════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  drawPageHeader(doc, "Bab 2: Otentikasi Login, Presensi & Buka Shift", "Operasional Pembukaan");

  curY = 18;
  curY = drawSectionHeader(
    doc,
    curY,
    "1. Tampilan Layar Otentikasi Login Operator",
    "Operator memilih tombol akun yang tersedia lalu mengetikkan 6 digit PIN rahasia pada keypad."
  );

  // Split Layout: Left Text, Right Screenshot
  const colW = (contentWidth - 6) / 2;
  const splitY = curY;

  // Left: Instructions
  doc.setFontSize(7.2);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2]);
  doc.text("Langkah-Langkah Login ke Sistem:", margin, splitY + 4);

  doc.setFontSize(6.3);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
  const loginSteps = [
    "1. Buka browser tablet kasir atau komputer kedai.",
    "2. Akses alamat resmi: https://juliacoffeemanagement.up.railway.app",
    "3. Pilih nama akun Anda pada daftar tombol cepat (contoh: Terminal Kasir POS atau Rama Leader Bar).",
    "4. Ketik 6 digit PIN otorisasi Anda melalui virtual keypad di layar.",
    "5. Sistem otomatis memvalidasi hash dan mengarahkan Anda ke modul sesuai peran Anda (Kasir -> POS, Barista -> KDS, Manager -> Dashboard)."
  ];
  loginSteps.forEach((st, i) => {
    const l = doc.splitTextToSize(st, colW - 4);
    doc.text(l, margin, splitY + 9 + i * 6.5);
  });

  // Right: Screenshot Login Screen
  drawImageBox(doc, SCREEN_LOGIN, margin + colW + 6, splitY, colW, 46, "Gambar 2.1: Layar Login Operator & Virtual Keypad PIN");

  curY = splitY + 54;

  curY = drawSectionHeader(
    doc,
    curY,
    "2. Prosedur Buka Shift Kasir Pagi (Opening Cash Float)",
    "Wajib dilakukan kasir sebelum memulai transaksi perdana hari itu."
  );

  drawCaseStudyBox(
    doc,
    margin,
    curY,
    contentWidth,
    "Kasus Buka Shift Kasir Pagi oleh Staf Kasir",
    "Kasir tiba di kedai pukul 07:30 WITA. Laci kasir diisi modal awal pecahan uang kembalian Rp 300.000 dari brankas kedai.",
    [
      "Kasir membuka menu POS -> Muncul jendela peringatan 'Shift Kasir Belum Dibuka'. Klik tombol 'Buka Shift Sekarang'.",
      "Ketik nominal Modal Awal Tunai: Rp 300.000 pada kolom modal kas laci.",
      "Klik tombol 'Konfirmasi Buka Shift'. Laci kasir otomatis terbuka dan status shift berubah menjadi AKTIF di pojok atas."
    ],
    "Sistem mencatat Modal Kasir Rp 300.000. Setiap transaksi tunai hari itu akan ditambahkan ke saldo awal ini."
  );

  drawPageFooter(doc, 3, totalPages);

  // ════════════════════════════════════════════════════════════════════════════
  // HALAMAN 4: BAB 3 - TERMINAL KASIR POS (DINE IN MEJA & TAKEAWAY)
  // ════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  drawPageHeader(doc, "Bab 3: Operasional Terminal Kasir POS", "Front of House");

  curY = 18;
  curY = drawSectionHeader(
    doc,
    curY,
    "1. Anatomi Antarmuka Terminal Kasir POS",
    "Desain antarmuka responsif tablet: katalog produk di sisi kiri dan keranjang transaksi di sisi kanan."
  );

  // Split Layout: Left Screenshot, Right Descriptions
  const posSplitY = curY;
  drawImageBox(doc, SCREEN_POS, margin, posSplitY, colW + 10, 52, "Gambar 3.1: Antarmuka Terminal Kasir POS Julia's Coffee");

  const descX = margin + colW + 14;
  const descW = contentWidth - (colW + 14);

  doc.setFontSize(7.2);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2]);
  doc.text("Penjelasan Area Kerja Layar POS:", descX, posSplitY + 4);

  doc.setFontSize(6.2);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
  const panelExpl = [
    "• Baris Atas: Tab Kategori Menu (Coffee, Non-Coffee, Meals, Snacks, Pastry), Kolom Cari Cepat, dan Tombol Sinkronisasi.",
    "• Grid Produk: Kartu menu lengkap dengan foto, nama, badge stok tersisa, dan harga jual satuan.",
    "• Panel Keranjang (Kanan): Daftar menu yang dipesan, pilihan varian (Hot/Iced), takaran gula (Normal/Less/No Sugar), dan extra shot.",
    "• Tab Meja (Dine In): Tombol pemilih nomor meja (Meja 01 s/d Meja 20) untuk tamu yang makan di tempat.",
    "• Tombol Aksi: 'Simpan Meja' (kirim ke KDS tanpa bayar) dan 'Bayar Sekarang' (langsung proses nota)."
  ];
  panelExpl.forEach((p, idx) => {
    const lines = doc.splitTextToSize(p, descW);
    doc.text(lines, descX, posSplitY + 9 + idx * 7.5);
  });

  curY = posSplitY + 60;

  curY = drawSectionHeader(
    doc,
    curY,
    "2. Studi Kasus Pemesanan Dine-In Meja dengan Penambahan Menu",
    "Simulasi nyata tamu duduk di meja dan melakukan pemesanan bertahap."
  );

  drawCaseStudyBox(
    doc,
    margin,
    curY,
    contentWidth,
    "Tamu Meja 04: Pesan Kopi Susu Aren + Tambah Croissant Nanti",
    "Pelanggan 2 orang datang pukul 14:00 WITA, duduk di Meja 04, pesan 2 Kopi Susu Aren Dingin (Less Sugar). 30 menit kemudian mereka pesan 1 Butter Croissant hangat.",
    [
      "Kasir klik tab 'Dine In' -> Pilih 'Meja 04'. Sentuh menu 'Kopi Susu Aren' 2x -> pilih modifier 'Less Sugar' -> klik 'Simpan Bill Meja'.",
      "Tiket 2 kopi langsung muncul di KDS Barista seketika dan status Meja 04 berubah warna menjadi KUNING (Terisi).",
      "Saat tamu memesan Croissant, kasir sentuh tab 'Open Bill' -> Meja 04 -> Sentuh menu 'Butter Croissant' -> klik 'Update Pesanan Meja'."
    ],
    "Semua item tergabung rapi dalam satu nomor pesanan Meja 04 tanpa membuat bon terpisah atau bon kertas hilang."
  );

  drawPageFooter(doc, 4, totalPages);

  // ════════════════════════════════════════════════════════════════════════════
  // HALAMAN 5: BAB 4 - ALUR PEMBAYARAN, SPLIT BILL & STRUK THERMAL/WA
  // ════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  drawPageHeader(doc, "Bab 4: Alur Pembayaran Kasir & Split Bill", "Kasir & Transaksi");

  curY = 18;
  curY = drawSectionHeader(
    doc,
    curY,
    "1. Metode Pembayaran Multi-Channel & Cetak Struk",
    "Aplikasi mendukung pembayaran Tunai (Cash), QRIS Dinamis/Statis, Kartu Debit, dan Transfer Bank."
  );

  autoTable(doc, {
    startY: curY,
    head: [["Metode Bayar", "Langkah Eksekusi Kasir", "Perangkat & Verifikasi", "Struk Pembayaran"]],
    body: [
      ["TUNAI (CASH)", "Input jumlah uang yang diserahkan tamu (misal: Rp 100.000). Sistem otomatis hitung uang kembalian.", "Laci kasir otomatis terbuka via sinyal printer ESC/POS.", "Struk fisik tercetak 80mm/58mm."],
      ["QRIS", "Pilih metode QRIS -> Tamu scan barcode QRIS di meja kasir -> Kasir cek notifikasi dana masuk di EDC/HP.", "Tidak melibatkan laci kasir tunai.", "Struk fisik + Opsi kirim PDF WhatsApp."],
      ["DEBIT / KARTU", "Pilih EDC Card -> Masukkan nomor batch/approval slip dari mesin EDC BCA/Mandiri.", "Kasir menggesek kartu tamu di mesin EDC fisik.", "Struk kasir diarsip bersama struk EDC."],
      ["TRANSFER BANK", "Khusus pesanan katering / acara besar: verifikasi mutasi rekening masuk melalui finance.", "Finance mengonfirmasi dana masuk ke rekening toko.", "Nota tagihan resmi diterbitkan PDF."]
    ],
    theme: "grid",
    headStyles: { fillColor: BRAND_NAVY as any, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 6.5 },
    bodyStyles: { fontSize: 6, textColor: TEXT_DARK as any, cellPadding: 1.5 },
    columnStyles: {
      0: { cellWidth: 26, fontStyle: "bold" },
      1: { cellWidth: 68 },
      2: { cellWidth: 46 },
      3: { cellWidth: 42, textColor: [4, 120, 87] },
    },
    margin: { left: margin, right: margin },
  });

  curY = (doc as any).lastAutoTable.finalY + 6;

  curY = drawSectionHeader(
    doc,
    curY,
    "2. Prosedur Split Bill (Pecah Tagihan Satu Meja Jadi 2 Pembayaran)",
    "Fasilitas pemecahan tagihan tanpa selisih desimal dan tanpa membatalkan pesanan induk."
  );

  drawCaseStudyBox(
    doc,
    margin,
    curY,
    contentWidth,
    "Simulasi Split Bill Meja 06: Tamu Minta Bayar Terpisah (QRIS & Tunai)",
    "Meja 06 total belanja Rp 95.000 (2 Kopi Susu Aren Rp 44.000 + 1 Nasi Goreng Rp 32.000 + 1 French Fries Rp 19.000). Tamu A mau bayar kopi miliknya sendiri via QRIS (Rp 44.000), Tamu B bayar sisanya Rp 51.000 via Tunai.",
    [
      "Buka Meja 06 di POS -> Klik tombol 'Split Bill' di bagian bawah keranjang.",
      "Pilih mode: 'Pecah Per Item' -> Centang 2 porsi Kopi Susu Aren (Subtotal Rp 44.000).",
      "Pilih metode pembayaran QRIS -> Klik 'Bayar Tagihan Terpilih'. Struk Rp 44.000 tercetak lunas.",
      "Sisa pesanan di Meja 06 otomatis tersisa Rp 51.000 (Nasi Goreng + Fries). Kasir klik 'Bayar Sisa Tagihan' -> pilih CASH -> selesai."
    ],
    "Meja 06 tertutup sempurna dengan 2 struk terpisah, 2 metode pembayaran berbeda, dan omzet terhitung 100% akurat tanpa selisih Rp."
  );

  drawPageFooter(doc, 5, totalPages);

  // ════════════════════════════════════════════════════════════════════════════
  // HALAMAN 6: BAB 5 - OTORISASI PIN, VOID & REFUND TRANSAKSI
  // ════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  drawPageHeader(doc, "Bab 5: Otorisasi PIN, Void & Refund Transaksi", "Keamanan & Pengawasan");

  curY = 18;
  curY = drawSectionHeader(
    doc,
    curY,
    "1. Mekanisme Supervisor PIN Approval (Anti-Fraud Control)",
    "Kasir dilarang membatalkan pesanan secara sepihak. Setiap void dan refund memerlukan verifikasi fisik Leader atau Manager."
  );

  autoTable(doc, {
    startY: curY,
    head: [["Jenis Tindakan Sensitif", "Syarat Otorisasi", "Dampak pada Stok Bahan Gudang", "Dampak Finansial"]],
    body: [
      [
        "Void Item (Sebelum Bayar)",
        "Kasir dapat menghapus item dari keranjang aktif.",
        "Stok belum terpotong di sistem gudang.",
        "Nilai total keranjang belanja berkurang."
      ],
      [
        "Void Pesanan (Setelah Terbit Nota)",
        "Wajib memasukkan PIN Role MANAGER, LEADER, atau SUPER_ADMIN.",
        "SELURUH BAHAN BAKU RESEP OTOMATIS DIKEMBALIKAN KE STOK GUDANG.",
        "Total pendapatan nota tersebut dibatalkan (Gross Sales berkurang)."
      ],
      [
        "Refund Pembayaran Tamu",
        "Wajib memasukkan PIN MANAGER & menyertakan alasan sah.",
        "Bahan baku makanan tidak dapat dikembalikan jika sudah dibuat (masuk waste).",
        "Uang tunai kasir berkurang untuk pengembalian dana tamu."
      ]
    ],
    theme: "grid",
    headStyles: { fillColor: [180, 83, 9], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 6.5 },
    bodyStyles: { fontSize: 6, textColor: TEXT_DARK as any, cellPadding: 1.8 },
    columnStyles: {
      0: { cellWidth: 38, fontStyle: "bold" },
      1: { cellWidth: 50 },
      2: { cellWidth: 54, textColor: [4, 120, 87] },
      3: { cellWidth: 40, textColor: [185, 28, 28] },
    },
    margin: { left: margin, right: margin },
  });

  curY = (doc as any).lastAutoTable.finalY + 6;

  curY = drawSectionHeader(
    doc,
    curY,
    "2. Studi Kasus Pembatalan Nota Pesanan Karena Salah Input",
    "Langkah resmi pembatalan pesanan di POS dengan pendampingan Leader Bar."
  );

  drawCaseStudyBox(
    doc,
    margin,
    curY,
    contentWidth,
    "Pembatalan Nota #JC-202610-0089 Karena Tamu Salah Sebut Menu",
    "Kasir menginput 3 cup 'Caramel Macchiato Iced' dan nota sudah terlanjur dicetak. Tamu menyatakan mereka memesan 'Cafe Latte'.",
    [
      "Kasir membuka menu 'Riwayat Transaksi' di POS -> Cari nomor nota #JC-202610-0089.",
      "Klik tombol merah 'Void Pesanan'. Layar memunculkan pop-up 'Otorisasi Supervisor Diperlukan'.",
      "Leader Bar (Rama) mendekati meja kasir, mengetikkan PIN supervisor miliknya, dan memilih alasan: 'Salah Input Menu Kasir'.",
      "Kasir membuatkan nota baru yang benar (3 Cafe Latte). Minuman salah input ditangani sesuai SOP waste."
    ],
    "Nota lama ditandai [VOID]. Audit log mencatat nama Leader Rama sebagai pemberi wewenang dan stok biji kopi/susu dikembalikan secara presisi."
  );

  drawPageFooter(doc, 6, totalPages);

  // ════════════════════════════════════════════════════════════════════════════
  // HALAMAN 7: BAB 6 - KITCHEN DISPLAY SYSTEM (KDS) MULTI-STATION
  // ════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  drawPageHeader(doc, "Bab 6: Kitchen Display System (KDS)", "Back of House");

  curY = 18;
  curY = drawSectionHeader(
    doc,
    curY,
    "1. Alur Tiket Pesanan Otomatis Multi-Stasiun",
    "Pesanan kasir terdistribusi seketika ke 3 stasiun tablet tanpa bon kertas: Barista, Kitchen, dan Pastry."
  );

  // Split Layout: Left Screenshot KDS, Right Table
  const kdsSplitY = curY;
  drawImageBox(doc, SCREEN_KDS, margin, kdsSplitY, colW + 10, 52, "Gambar 6.1: Layar Antrean KDS Tablet Stasiun Bar & Dapur");

  doc.setFontSize(7.2);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2]);
  doc.text("Arti Warna Tiket pada Layar KDS:", descX, kdsSplitY + 4);

  const kdsBadges = [
    { color: [239, 68, 68], title: "KARTU MERAH / KUNING (Antrean Masuk):", desc: "Pesanan baru saja dikirim oleh kasir. Belum disentuh oleh staf peracik." },
    { color: [245, 158, 11], title: "KARTU ORANYE (Sedang Dibuat / Cooking):", desc: "Barista / Chef menyentuh kartu tanda mulai meracik atau memasak pesanan." },
    { color: [16, 185, 129], title: "KARTU HIJAU (Siap Antar / Ready to Serve):", desc: "Pesanan selesai diracik. Notifikasi suara berbunyi agar waiter mengambil ke meja." },
    { color: [100, 116, 139], title: "KARTU ABU-ABU (Selesai / Completed):", desc: "Pesanan telah disajikan ke tamu. Kartu otomatis hilang dari layar KDS dalam 10 detik." },
  ];

  kdsBadges.forEach((b, idx) => {
    const by = kdsSplitY + 10 + idx * 10.5;
    doc.setFillColor(b.color[0], b.color[1], b.color[2]);
    doc.circle(descX + 2, by, 1.8, "F");

    doc.setFontSize(6.2);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2]);
    doc.text(b.title, descX + 6, by + 1);

    doc.setFontSize(5.8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
    const lines = doc.splitTextToSize(b.desc, descW - 6);
    doc.text(lines, descX + 6, by + 4.5);
  });

  curY = kdsSplitY + 60;

  curY = drawSectionHeader(
    doc,
    curY,
    "2. Standar Waktu Penyajian Pesanan (SLA Service Time)",
    "Target durasi waktu pembuatan pesanan Julia's Coffee & Eatery."
  );

  autoTable(doc, {
    startY: curY,
    head: [["Kategori Menu", "Stasiun Pelaksana", "Target Waktu Standar", "Tindakan Jika Terjadi Keterlambatan"]],
    body: [
      ["Espresso & Kopi Susu Dingin", "Barista (Stasiun Bar)", "Maksimal 3 - 5 Menit", "Barista kedua membantu membagi pembuatan susu dan shot espresso."],
      ["Manual Brew (V60 / Japanese)", "Leader / Senior Barista", "Maksimal 7 - 9 Menit", "Kasir menginfokan tamu di awal bahwa manual brew diseduh perlahan."],
      ["Makanan Hangat (Rice Bowl / Pasta)", "Chef Dapur (Kitchen)", "Maksimal 12 - 15 Menit", "Jika waktu KDS melebihi 15 menit, kartu berkedip merah (Alert Lambat)."],
      ["Pastry & Croissant Display", "Baker / Waiter", "Maksimal 2 - 4 Menit", "Penghangatan oven toaster 2 menit, langsung diantar ke meja tamu."]
    ],
    theme: "grid",
    headStyles: { fillColor: ACCENT_BLUE as any, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 6.5 },
    bodyStyles: { fontSize: 6, textColor: TEXT_DARK as any, cellPadding: 1.5 },
    columnStyles: {
      0: { cellWidth: 46, fontStyle: "bold" },
      1: { cellWidth: 38 },
      2: { cellWidth: 36, fontStyle: "bold", textColor: [4, 120, 87] },
      3: { cellWidth: 62 },
    },
    margin: { left: margin, right: margin },
  });

  drawPageFooter(doc, 7, totalPages);

  // ════════════════════════════════════════════════════════════════════════════
  // HALAMAN 8: BAB 7 - KALIBRASI ESPRESSO, WASTE & BAHAN RUSAK
  // ════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  drawPageHeader(doc, "Bab 7: SOP Kalibrasi Espresso & Waste Bahan", "Standar Rasa & HPP");

  curY = 18;
  curY = drawSectionHeader(
    doc,
    curY,
    "1. Standar Parameter Kalibrasi Espresso Pagi Julia's Coffee",
    "Dialing grinder wajib dilakukan setiap pagi untuk menyesuaikan suhu ruangan dan kelembaban udara."
  );

  autoTable(doc, {
    startY: curY,
    head: [["Parameter Espresso", "Standar Resep Julia's", "Toleransi Diizinkan", "Dampak Jika Di Luar Standar"]],
    body: [
      ["Dose (Gramatur Bubuk Kopi)", "18.0 Gram", "17.8 - 18.2 Gram", "Kurang: rasa hambar (under-extracted). Berlebih: pahit pekat menyengat."],
      ["Yield (Berat Hasil Ekstraksi)", "36.0 Gram (Rasio 1:2)", "34.0 - 38.0 Gram", "Yield terlalu sedikit: rasa asam berlebih (sour). Yield terlalu banyak: pahit sepat."],
      ["Extraction Time (Waktu Seduh)", "27 Detik", "25 - 30 Detik", "<24 Detik: grind size terlalu kasar. >31 Detik: grind size terlalu halus/mampet."],
      ["Suhu Air Boiler Mesin", "93.0 °C", "92.0 - 94.0 °C", "Suhu dingin kopi berbusa tipis. Suhu terlalu panas kopi gosong (*burnt*)."]
    ],
    theme: "grid",
    headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 6.5 },
    bodyStyles: { fontSize: 6, textColor: TEXT_DARK as any, cellPadding: 1.8 },
    columnStyles: {
      0: { cellWidth: 44, fontStyle: "bold" },
      1: { cellWidth: 38, fontStyle: "bold", textColor: ACCENT_BLUE as any },
      2: { cellWidth: 38 },
      3: { cellWidth: 62 },
    },
    margin: { left: margin, right: margin },
  });

  curY = (doc as any).lastAutoTable.finalY + 6;

  curY = drawSectionHeader(
    doc,
    curY,
    "2. Studi Kasus Pencatatan Biji Terbuang & Susu Rusak (Waste Tracking)",
    "Pencatatan langsung via tombol 'Kalibrasi & Waste' di layar kasir POS."
  );

  drawCaseStudyBox(
    doc,
    margin,
    curY,
    contentWidth,
    "Pencatatan Dial-in Pagi 36g Kopi & Susu Pecah 200ml",
    "Barista Budi melakukan dialing pagi: 2 shot espresso dibuang (total 36 gram biji kopi house blend). Pukul 15:00, 200ml susu UHT pecah akibat panas steam wand.",
    [
      "Buka menu POS -> Klik ikon cangkir 'Kalibrasi & Waste' di sudut atas layar kasir.",
      "Pilih bahan: 'House Blend Espresso Beans' -> Masukkan gramatur: 36 gr -> Pilih alasan: 'Kalibrasi Espresso Dial-In Pagi'.",
      "Klik simpan. Lakukan input kedua untuk 'Fresh Milk Greenfields' -> Masukkan: 200 ml -> Pilih alasan: 'Kerusakan / Human Error'.",
      "Sistem memotong stok fisik gudang dan menghitung nilai rupiah kerugian HPP secara otomatis."
    ],
    "Stok biji kopi terpotong 36g (HPP Rp 9.000) dan susu terpotong 200ml (HPP Rp 3.700). Kerugian tercatat rapi di Laporan Biaya Waste Bulanan."
  );

  drawPageFooter(doc, 8, totalPages);

  // ════════════════════════════════════════════════════════════════════════════
  // HALAMAN 9: BAB 8 - TUTUP SHIFT KASIR & REKONSILIASI Z-REPORT
  // ════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  drawPageHeader(doc, "Bab 8: Tutup Shift Kasir & Rekonsiliasi Z-Report", "Penutupan Harian");

  curY = 18;
  curY = drawSectionHeader(
    doc,
    curY,
    "1. Alur Penutupan Kasir Malam & Penghitungan Fisik Kas",
    "Kasir dan Leader Bar wajib bersama-sama membuka laci dan menghitung seluruh lembar uang."
  );

  // Split Layout: Left Screenshot Shift, Right Calculations
  const shiftSplitY = curY;
  drawImageBox(doc, SCREEN_SHIFTS, margin, shiftSplitY, colW + 10, 52, "Gambar 8.1: Layar Rekonsiliasi Tutup Shift Kasir & Z-Report");

  doc.setFontSize(7.2);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2]);
  doc.text("Rumus Rekonsiliasi Kas Laci (Z-Report):", descX, shiftSplitY + 4);

  doc.setFontSize(6.2);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
  const shiftFormulas = [
    "• Saldo Kas Diharapkan = Modal Awal + Total Penjualan Tunai - Pengeluaran Kas Kasir.",
    "• Uang Fisik Aktual = Jumlah total uang lembaran & koin yang dihitung fisik di laci saat itu.",
    "• Selisih Kas = Uang Fisik Aktual - Saldo Kas Diharapkan.",
    "• [HIJAU] Selisih Rp 0 = Kas seimbang sempurna (Lunas).",
    "• [BIRU] Selisih Lebih (+) = Ada kelebihan uang di laci kasir (wajib dicatat di catatan shift).",
    "• [MERAH] Selisih Kurang (-) = Terjadi kekurangan kas (wajib investigasi & dicatat di audit log)."
  ];
  shiftFormulas.forEach((sf, idx) => {
    const lines = doc.splitTextToSize(sf, descW);
    doc.text(lines, descX, shiftSplitY + 9 + idx * 7.2);
  });

  curY = shiftSplitY + 60;

  curY = drawSectionHeader(
    doc,
    curY,
    "2. Studi Kasus Penutupan Kasir Malam dengan Selisih Kurang",
    "Prosedur resmi apabila uang tunai di laci tidak sama dengan angka sistem POS."
  );

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

  drawPageFooter(doc, 9, totalPages);

  // ════════════════════════════════════════════════════════════════════════════
  // HALAMAN 10: BAB 9 - RESEP (BOM), STOK & AUDIT STOK OPNAME
  // ════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  drawPageHeader(doc, "Bab 9: Resep, Stok Bahan & Audit Stok Opname", "Gudang & Inventori");

  curY = 18;
  curY = drawSectionHeader(
    doc,
    curY,
    "1. Struktur Resep Bahan Baku (Bill of Materials - BOM)",
    "Setiap menu yang terjual di POS memotong gramatur bahan di gudang secara otomatis."
  );

  // Split Layout: Left Table BOM, Right Screenshot
  const invSplitY = curY;

  autoTable(doc, {
    startY: invSplitY,
    head: [["Menu Kopi & Eatery", "Takaran Bahan Terpotong", "Biaya HPP Satuan"]],
    body: [
      ["Kopi Susu Aren (Iced)", "18g Espresso Beans\n120ml Susu Greenfields\n25ml Aren Cair\n120g Es Batu Crystal", "Rp 6.850 / cup\n(Harga Jual: Rp 22.000)\nMargin: 68.8%"],
      ["Americano Iced", "18g Espresso Beans\n150ml Air Bersih RO\n150g Es Batu Crystal", "Rp 4.750 / cup\n(Harga Jual: Rp 18.000)\nMargin: 73.6%"],
      ["Nasi Goreng Special", "150g Beras Pulen\n1 Butir Telur Ayam\n50g Suwir Daging Ayam\nPorsi Bumbu Racik", "Rp 11.500 / porsi\n(Harga Jual: Rp 32.000)\nMargin: 64.0%"]
    ],
    theme: "grid",
    headStyles: { fillColor: BRAND_NAVY as any, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 6 },
    bodyStyles: { fontSize: 5.8, textColor: TEXT_DARK as any, cellPadding: 1.5 },
    columnStyles: {
      0: { cellWidth: 26, fontStyle: "bold" },
      1: { cellWidth: 36 },
      2: { cellWidth: 24, textColor: [4, 120, 87], fontStyle: "bold" },
    },
    margin: { left: margin, right: margin + colW + 4 },
  });

  drawImageBox(doc, SCREEN_INVENTORY, margin + colW + 4, invSplitY, colW - 4, 52, "Gambar 9.1: Layar Manajemen Stok & Resep Menu");

  curY = invSplitY + 58;

  curY = drawSectionHeader(
    doc,
    curY,
    "2. Prosedur Audit Stok Opname Mingguan (Timbang Fisik)",
    "Pencocokan saldo sistem dengan fisik riil di bar & kitchen setiap hari Minggu malam."
  );

  drawCaseStudyBox(
    doc,
    margin,
    curY,
    contentWidth,
    "Audit Stok Opname Mingguan: Biji Kopi Selisih Minus 150 Gram",
    "Leader Bar menimbang seluruh toples biji kopi sisa di bar. Timbangan menunjukkan 2.850 gram, sedangkan angka di sistem mencatat 3.000 gram (ada selisih minus 150 gram).",
    [
      "Buka menu 'Inventori' -> Tab 'Stok Opname' -> Klik 'Mulai Sesi Opname'.",
      "Ketik angka timbangan riil: 2850 pada kolom 'Stok Fisik Aktual' biji kopi house blend.",
      "Sistem menghitung otomatis: Selisih = 2.850 - 3.000 = -150 gr. Defisit Rupiah = 150 gr x Rp 250/gr = -Rp 37.500.",
      "Manager mengisi catatan: 'Selisih wajar kalibrasi harian dan residual grinder'. Klik 'Finalisasi Koreksi Stok'."
    ],
    "Kartu stok otomatis terkoreksi menjadi 2.850 gram dan nilai defisit Rp 37.500 masuk ke Jurnal Penyesuaian HPP tanpa merusak saldo akun lain."
  );

  drawPageFooter(doc, 10, totalPages);

  // ════════════════════════════════════════════════════════════════════════════
  // HALAMAN 11: BAB 10 - PENGADAAN BAHAN (PO), PETTY CASH & PAYROLL
  // ════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  drawPageHeader(doc, "Bab 10: Pengadaan Bahan, Petty Cash & Payroll", "Manajemen Finansial");

  curY = 18;
  curY = drawSectionHeader(
    doc,
    curY,
    "1. Siklus Pembelian Bahan Baku (Purchase Order - PO Supplier)",
    "Standar pengadaan resmi biji kopi dan bahan baku agar stok tidak pernah kosong."
  );

  autoTable(doc, {
    startY: curY,
    head: [["Tahap Pengadaan", "Aktor Pelaksana", "Aksi di Menu Pembelian", "Hasil Data Sistem"]],
    body: [
      ["1. Peringatan Stok Tipis", "Sistem / Leader", "Sistem menampilkan label kuning saat stok menyentuh batas minimum stok (minStock).", "Notifikasi restock terbit otomatis."],
      ["2. Pembuatan Draft PO", "Manager", "Pilih Supplier (misal: PT Roastery Kopi Nusantara) -> Masukkan item & harga satuan.", "Nomor PO resmi diterbitkan (#PO-0042)."],
      ["3. Penerimaan Barang", "Leader Bar / Dapur", "Barang tiba di kedai -> Timbang berat fisik karung kopi -> Cek faktur fisik.", "Kesesuaian kuantitas terverifikasi."],
      ["4. Input Penerimaan", "Manager / Kasir", "Buka PO #PO-0042 -> Klik 'Terima Barang' -> Masukkan tanggal kedaluwarsa.", "STOK GUDANG OTOMATIS BERTAMBAH."],
      ["5. Pembayaran Supplier", "Finance", "Catat pengeluaran pembayaran via Rekening Bank Toko atau Petty Cash.", "Hutang supplier lunas & kas tercatat."]
    ],
    theme: "grid",
    headStyles: { fillColor: ACCENT_BLUE as any, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 6.5 },
    bodyStyles: { fontSize: 6, textColor: TEXT_DARK as any, cellPadding: 1.5 },
    columnStyles: {
      0: { cellWidth: 32, fontStyle: "bold" },
      1: { cellWidth: 28 },
      2: { cellWidth: 68 },
      3: { cellWidth: 54, textColor: [4, 120, 87] },
    },
    margin: { left: margin, right: margin },
  });

  curY = (doc as any).lastAutoTable.finalY + 6;

  curY = drawSectionHeader(
    doc,
    curY,
    "2. Penggajian Karyawan & Cetak Slip Gaji Digital (Payroll)",
    "Penghitungan gaji otomatis berdasarkan presensi kehadiran GPS, lembur, dan insentif omzet."
  );

  // Split Layout: Left Text, Right Screenshot Payroll
  const paySplitY = curY;
  const payDescW = contentWidth - (colW + 10);

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2]);
  doc.text("Fitur Modul Payroll Julia's Coffee:", margin, paySplitY + 4);

  doc.setFontSize(6.2);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
  const payPoints = [
    "• Integrasi Presensi GPS: Gaji harian dihitung dari jam Clock-In sah di dalam radius kedai.",
    "• Perhitungan Lembur: Jam lembur terverifikasi dikalikan tarif upah per jam yang berlaku.",
    "• Bonus Target Omzet: Jika omzet kedai melampaui target bulanan, bonus tim otomatis terbagi rata.",
    "• Potongan Kasbon / Keterlambatan: Otomatis memotong gaji kotor secara transparan.",
    "• Cetak Slip Gaji PDF: Sekali klik tombol 'Slip Gaji', dokumen resmi PDF terbit dengan rincian bersih siap kirim via WhatsApp."
  ];
  payPoints.forEach((p, idx) => {
    const lines = doc.splitTextToSize(p, payDescW);
    doc.text(lines, margin, paySplitY + 9 + idx * 7.5);
  });

  drawImageBox(doc, SCREEN_PAYROLL, margin + payDescW + 4, paySplitY, colW + 6, 44, "Gambar 10.1: Layar Manajemen Payroll & Slip Gaji");

  drawPageFooter(doc, 11, totalPages);

  // ════════════════════════════════════════════════════════════════════════════
  // HALAMAN 12: BAB 11 - DASHBOARD OWNER, AUDIT TRAIL & RESET BERSIH
  // ════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  drawPageHeader(doc, "Bab 11: Dashboard Owner, Audit & Reset Uji Coba", "Eksekutif & Maintenance");

  curY = 18;
  curY = drawSectionHeader(
    doc,
    curY,
    "1. Dashboard Eksekutif Owner (Monitoring Laba Rugi P&L Realtime)",
    "Owner dapat memantau seluruh transaksi, laba kotor, dan biaya operasional langsung dari smartphone."
  );

  // Split Layout: Left Screenshot Dashboard, Right Ratios
  const dashSplitY = curY;
  drawImageBox(doc, SCREEN_DASHBOARD, margin, dashSplitY, colW + 10, 50, "Gambar 11.1: Dashboard Eksekutif Owner & KPI Toko");

  doc.setFontSize(7.2);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2]);
  doc.text("Indikator Kesehatan Finansial Kedai:", descX, dashSplitY + 4);

  const finRules = [
    "• Gross Sales: Total penjualan kotor sebelum diskon dan promo.",
    "• Net Sales: Uang riil yang masuk dari pelanggan setelah diskon.",
    "• COGS / HPP Bahan: Biaya bahan baku yang terpotong otomatis dari resep.",
    "  -> Standar Sehat Kedai Julia's: 28% s/d 35% dari Net Sales.",
    "• Gross Profit: Laba kotor kedai (Target Sehat: 65% - 72%).",
    "• Beban Operasional: Biaya kas kecil & belanja operasional harian.",
    "• Net Profit Margin: Laba bersih akhir pemilik kedai (Target: 20% - 30%)."
  ];
  finRules.forEach((fr, idx) => {
    const lines = doc.splitTextToSize(fr, descW);
    doc.text(lines, descX, dashSplitY + 9 + idx * 5.8);
  });

  curY = dashSplitY + 58;

  curY = drawSectionHeader(
    doc,
    curY,
    "2. Prosedur Reset Data Uji Coba Menjelang Peluncuran (Go-Live)",
    "Fasilitas pembersihan riwayat transaksi dummy di awal bulan depan tanpa menghapus master data."
  );

  drawCaseStudyBox(
    doc,
    margin,
    curY,
    contentWidth,
    "Prosedur Pembersihan Data Transaksi Uji Coba oleh Super Admin",
    "Di awal bulan depan setelah staf selesai melakukan simulasi uji coba aplikasi, seluruh nota pesanan dummy, kas uji coba, dan shift harus dibersihkan agar sistem mulai dari angka 0 pada hari peluncuran resmi.",
    [
      "Login sebagai Super Admin (username: 'admin') -> Buka menu 'Pengaturan' -> Submenu 'Pemeliharaan Database'.",
      "Pada panel 'Reset Transaksi Uji Coba', masukkan PIN Super Admin yang sah.",
      "Ketik teks konfirmasi persis: 'HAPUS DATA UJI COBA' untuk membuka kunci pengaman.",
      "Klik tombol merah 'Mulai Bersihkan Riwayat Transaksi'."
    ],
    "Seluruh order dummy dan riwayat shift terhapus 100% bersih. DAFTAR MENU, HARGA, RESEP, STOK GUDANG, DAN 9 AKUN USER TETAP UTUH AMAN."
  );

  drawPageFooter(doc, 12, totalPages);

  // Save to public directory
  const outPath = path.join(process.cwd(), "public", "Buku_Panduan_Lengkap_Julia_Coffee.pdf");
  fs.writeFileSync(outPath, Buffer.from(doc.output("arraybuffer")));
  console.log(`[Detailed Manual Book] Successfully generated 12-page manual: ${outPath}`);
};

// ============================================================================
// DOKUMEN 2: PANDUAN SPESIFIK KASIR & KDS (FRONT & BACK OF HOUSE - 5 HALAMAN)
// ============================================================================
export const generateKasirKdsRoleGuide = () => {
  const doc = new JsPDFConstructor("p", "mm", "a4");
  const margin = 14;
  const contentWidth = doc.internal.pageSize.getWidth() - margin * 2;
  const colW = (contentWidth - 6) / 2;
  const descX = margin + colW + 6;
  const descW = contentWidth - (colW + 6);
  const totalPages = 5;

  // ─── HALAMAN 1: LOGIN & BUKA SHIFT KASIR ───
  drawPageHeader(doc, "Panduan Kasir & KDS: Login & Buka Shift", "Front of House");

  let curY = 18;
  curY = drawSectionHeader(doc, curY, "1. Otentikasi Kasir & Prosedur Modal Awal Laci", "Persiapan pembukaan toko pukul 07:30 WITA.");

  const s1Y = curY;
  drawImageBox(doc, SCREEN_LOGIN, margin, s1Y, colW, 46, "Gambar K.1: Layar Login Operator POS");

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2]);
  doc.text("Langkah Buka Shift Kasir Pagi:", descX, s1Y + 4);

  doc.setFontSize(6.2);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
  const s1Steps = [
    "1. Sentuh tombol akun 'Terminal Kasir POS' pada layar login.",
    "2. Masukkan 6 digit PIN otorisasi kasir pada keypad virtual.",
    "3. Buka menu POS -> Klik tombol 'Buka Shift Kasir'.",
    "4. Hitung modal uang pecahan kembalian dari brankas (default Rp 300.000).",
    "5. Masukkan nominal ke kolom modal awal -> Klik konfirmasi buka shift.",
    "6. Laci kasir otomatis terbuka dan status shift menjadi AKTIF."
  ];
  s1Steps.forEach((st, idx) => {
    const l = doc.splitTextToSize(st, descW);
    doc.text(l, descX, s1Y + 9 + idx * 6);
  });

  curY = s1Y + 54;
  curY = drawSectionHeader(doc, curY, "2. Checklist Kesiapan Bar & Kalibrasi Mesin");

  drawCaseStudyBox(
    doc,
    margin,
    curY,
    contentWidth,
    "SOP Pembukaan: Kalibrasi Espresso 18g Dose / 36g Yield",
    "Sebelum melayani tamu pertama, barista wajib melakukan ekstraksi espresso uji coba (dial-in) untuk memastikan rasa seimbang.",
    [
      "Timbang 18 gram bubuk kopi ke portafilter, ratakan dengan distributor dan tamping merata.",
      "Ekstraksi di mesin espresso: pastikan yield mencapai 36 gram dalam waktu 26 - 30 detik.",
      "Buka menu POS -> Klik 'Kalibrasi & Waste' -> Masukkan gramatur kopi terbuang saat dialing (misal: 36 gr kopi) -> Simpan."
    ],
    "Kualitas kopi terjamin konsisten dan biji terbuang saat dialing tercatat resmi sebagai waste operasional tanpa kebocoran HPP."
  );

  drawPageFooter(doc, 1, totalPages);

  // ─── HALAMAN 2: KATALOG POS & TRANSAKSI DINE-IN ───
  doc.addPage();
  drawPageHeader(doc, "Panduan Kasir & KDS: Transaksi Dine-In Meja", "Pelayanan Kasir");

  curY = 18;
  curY = drawSectionHeader(doc, curY, "3. Operasional Kasir POS (Pemesanan Meja)", "Melayani tamu makan di tempat dengan fleksibilitas penambahan menu.");

  const s2Y = curY;
  drawImageBox(doc, SCREEN_POS, margin, s2Y, colW + 10, 52, "Gambar K.2: Terminal Kasir POS Julia's Coffee");

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2]);
  doc.text("Fitur Utama Terminal Kasir:", descX, s2Y + 4);

  const posFeatures = [
    "• Tab Meja: Pilih nomor meja tamu (Dine In Meja 01 s/d 20) atau Take Away.",
    "• Modifier Resep: Pilih Hot / Iced, takaran gula (Normal, Less, No Sugar), dan extra espresso shot.",
    "• Diskon Promo: Masukkan voucher promo resmi atau potongan harga khusus.",
    "• Simpan Meja: Pesanan langsung terkirim ke KDS dapur tanpa harus bayar duluan."
  ];
  posFeatures.forEach((f, idx) => {
    const l = doc.splitTextToSize(f, descW);
    doc.text(l, descX, s2Y + 9 + idx * 7.5);
  });

  curY = s2Y + 60;
  curY = drawSectionHeader(doc, curY, "4. Studi Kasus Pemesanan Bertahap Meja 04");

  drawCaseStudyBox(
    doc,
    margin,
    curY,
    contentWidth,
    "Tamu Meja 04 Pesan Kopi, Lalu Tambah Makanan 30 Menit Kemudian",
    "Tamu duduk di Meja 04 pesan 2 Kopi Susu Aren dingin. Setengah jam kemudian mereka menambah 1 Nasi Goreng Special.",
    [
      "Kasir sentuh tab Dine In -> Meja 04 -> Sentuh Kopi Susu Aren 2x (pilih less sugar) -> Klik 'Simpan Bill Meja'.",
      "Tiket 2 kopi otomatis tampil di layar KDS Barista. Tamu menikmati minumannya.",
      "Saat tamu pesan makan, kasir buka tab 'Bill Meja' -> Meja 04 -> Sentuh 'Nasi Goreng' -> Klik 'Update Pesanan Meja'.",
      "KDS Kitchen menerima tiket Nasi Goreng tanpa mengubah status kopi yang sudah selesai."
    ],
    "Pesanan terakumulasi rapi di Meja 04 dan siap dibayar saat tamu selesai makan."
  );

  drawPageFooter(doc, 2, totalPages);

  // ─── HALAMAN 3: PEMBAYARAN & SPLIT BILL ───
  doc.addPage();
  drawPageHeader(doc, "Panduan Kasir & KDS: Pembayaran & Split Bill", "Pembayaran & Struk");

  curY = 18;
  curY = drawSectionHeader(doc, curY, "5. Alur Pembayaran & Split Bill Tagihan Meja", "Mendukung Cash, QRIS, EDC, Split Bill per menu dan bagi rata.");

  autoTable(doc, {
    startY: curY,
    head: [["Skenario Tamu", "Instruksi Eksekusi di POS", "Perangkat Kasir & Hasil Nota"]],
    body: [
      ["Tamu Bayar Tunai (Cash)", "Pilih CASH -> Masukkan nominal uang yang diserahkan -> Sistem hitung kembalian.", "Laci kasir otomatis terbuka. Struk thermal tercetak."],
      ["Tamu Bayar QRIS", "Pilih QRIS -> Tamu scan barcode -> Kasir verifikasi dana masuk.", "Struk thermal tercetak + Opsi kirim PDF WhatsApp."],
      ["Tamu Minta Split Bill", "Buka Meja -> Klik 'Split Bill' -> Pilih mode 'Pecah Menu' -> Bayar tagihan 1 -> Bayar sisa tagihan 2.", "Terbit 2 struk terpisah tanpa selisih desimal Rp."]
    ],
    theme: "grid",
    headStyles: { fillColor: BRAND_NAVY as any, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 6.5 },
    bodyStyles: { fontSize: 6, textColor: TEXT_DARK as any, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 42, fontStyle: "bold" },
      1: { cellWidth: 84 },
      2: { cellWidth: 56, textColor: [4, 120, 87] },
    },
    margin: { left: margin, right: margin },
  });

  curY = (doc as any).lastAutoTable.finalY + 6;
  curY = drawSectionHeader(doc, curY, "6. Studi Kasus Split Bill Tamu Meja 06 (QRIS & Tunai)");

  drawCaseStudyBox(
    doc,
    margin,
    curY,
    contentWidth,
    "Simulasi Split Bill: Tagihan Rp 95.000 Dibagi 2 Orang",
    "Tamu A ingin membayar 2 Kopi miliknya (Rp 44.000) via QRIS, Tamu B membayar makanan Rp 51.000 via Tunai.",
    [
      "Buka Meja 06 di POS -> Klik tombol 'Split Bill'.",
      "Pilih 'Pecah Per Item' -> Centang 2 Kopi Susu Aren (Rp 44.000) -> Klik 'Bayar Tagihan Terpilih'.",
      "Pilih metode QRIS -> Transaksi pertama lunas dan struk tercetak.",
      "Sisa tagihan Meja 06 otomatis tersisa Rp 51.000. Kasir klik 'Bayar Sisa Meja' -> pilih CASH -> input Rp 100.000 -> kembalian Rp 49.000."
    ],
    "Meja 06 tertutup sempurna dengan 2 bukti pembayaran sah tanpa selisih uang."
  );

  drawPageFooter(doc, 3, totalPages);

  // ─── HALAMAN 4: KDS LAYAR DAPUR & BARISTA ───
  doc.addPage();
  drawPageHeader(doc, "Panduan Kasir & KDS: Layar KDS Multi-Stasiun", "Back of House");

  curY = 18;
  curY = drawSectionHeader(doc, curY, "7. Prosedur Layar Kitchen Display System (/kds)", "Tablet stasiun Barista, Kitchen, dan Pastry.");

  const s4Y = curY;
  drawImageBox(doc, SCREEN_KDS, margin, s4Y, colW + 10, 52, "Gambar K.3: Layar Antrean KDS Tablet Stasiun Barista & Dapur");

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2]);
  doc.text("Alur Penanganan Tiket KDS:", descX, s4Y + 4);

  const kdsSteps = [
    "1. Tiket Masuk (Merah/Kuning): Pesanan baru dari kasir otomatis muncul dengan suara alert.",
    "2. Mulai Buat (Oranye): Barista/Koki menyentuh tiket saat mulai meracik atau memasak.",
    "3. Selesai (Hijau): Sentuh tombol 'SELESAI' saat hidangan siap diantar ke meja tamu.",
    "4. Waktu Standar: Minuman maks 3-5 menit, makanan hangat maks 12-15 menit."
  ];
  kdsSteps.forEach((ks, idx) => {
    const l = doc.splitTextToSize(ks, descW);
    doc.text(l, descX, s4Y + 9 + idx * 8.5);
  });

  curY = s4Y + 60;
  curY = drawSectionHeader(doc, curY, "8. SOP Penanganan Pembatalan (Void) & Susu Rusak");

  drawCaseStudyBox(
    doc,
    margin,
    curY,
    contentWidth,
    "Penanganan Susu Pecah di Bar & Pembatalan Menu Salah Input",
    "Barista mendapati 200ml susu pecah saat disteam, dan tamu membatalkan 1 cup kopi karena terburu-buru pulang.",
    [
      "Buka POS -> Klik 'Kalibrasi & Waste' -> Pilih susu Greenfields -> Masukkan 200 ml -> Simpan sebagai waste rusak.",
      "Untuk nota yang dibatalkan: Kasir buka Riwayat -> Klik Void Pesanan -> Panggil Leader Bar.",
      "Leader Bar memasukkan PIN supervisor -> Memilih alasan pembatalan -> Konfirmasi void."
    ],
    "Stok bahan kembali ke gudang untuk item yang divoid, kerugian susu pecah tercatat di laporan waste, dan audit log merekam nama supervisor."
  );

  drawPageFooter(doc, 4, totalPages);

  // ─── HALAMAN 5: TUTUP SHIFT KASIR & Z-REPORT ───
  doc.addPage();
  drawPageHeader(doc, "Panduan Kasir & KDS: Tutup Shift & Z-Report", "Penutupan Kasir");

  curY = 18;
  curY = drawSectionHeader(doc, curY, "9. Prosedur Tutup Shift Kasir Malam (Z-Report)", "Pukul 22:30 WITA bersama Leader Bar / Supervisor.");

  const s5Y = curY;
  drawImageBox(doc, SCREEN_SHIFTS, margin, s5Y, colW + 10, 52, "Gambar K.4: Layar Rekonsiliasi Tutup Shift Kasir Malam");

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2]);
  doc.text("Langkah Rekonsiliasi Kas Laci:", descX, s5Y + 4);

  const shiftSteps = [
    "1. Klik tombol 'Tutup Shift' di sudut kanan atas layar POS.",
    "2. Keluarkan seluruh uang lembaran dan koin dari laci kasir.",
    "3. Hitung fisik uang bersama Leader Bar (hitung 2 kali).",
    "4. Ketikkan angka total uang riil ke kolom 'Uang Fisik Aktual'.",
    "5. Sistem otomatis membandingkan dengan saldo kas sistem (Modal Awal + Penjualan Tunai).",
    "6. Cetak slip Z-Report thermal dan serahkan uang fisik ke brankas."
  ];
  shiftSteps.forEach((ss, idx) => {
    const l = doc.splitTextToSize(ss, descW);
    doc.text(l, descX, s5Y + 9 + idx * 7);
  });

  curY = s5Y + 60;
  curY = drawSectionHeader(doc, curY, "10. Penanganan Selisih Kas (Over / Short)");

  drawCaseStudyBox(
    doc,
    margin,
    curY,
    contentWidth,
    "SOP Jika Terjadi Selisih Kas di Laci Kasir",
    "Uang fisik dihitung Rp 1.540.000, sedangkan target sistem mencatat Rp 1.550.000 (Selisih kurang Rp 10.000).",
    [
      "Cek kembali apakah ada bon kasbon atau nota petty cash kasir yang belum diinput ke sistem.",
      "Jika uang fisik tetap kurang Rp 10.000, ketikkan Rp 1.540.000 apa adanya ke sistem.",
      "Ketik catatan alasan di kolom shift: 'Selisih kurang Rp 10.000, kemungkinan salah kembalian'.",
      "Leader Bar memasukkan PIN otorisasi penutupan dan mencetak slip Z-Report harian."
    ],
    "Selisih tercatat transparan di Audit Shift harian dan tidak dimanipulasi, sehingga riwayat kasir dapat dipertanggungjawabkan secara sah."
  );

  drawPageFooter(doc, 5, totalPages);

  const outPath = path.join(process.cwd(), "public", "Panduan_Operasional_Kasir_dan_KDS.pdf");
  fs.writeFileSync(outPath, Buffer.from(doc.output("arraybuffer")));
  console.log(`[Kasir Guide] Generated 5-page manual: ${outPath}`);
};

// ============================================================================
// DOKUMEN 3: PANDUAN MANAJERIAL OWNER & MANAGER (5 HALAMAN)
// ============================================================================
export const generateManagerOwnerRoleGuide = () => {
  const doc = new JsPDFConstructor("p", "mm", "a4");
  const margin = 14;
  const contentWidth = doc.internal.pageSize.getWidth() - margin * 2;
  const colW = (contentWidth - 6) / 2;
  const descX = margin + colW + 6;
  const descW = contentWidth - (colW + 6);
  const totalPages = 5;

  // ─── HALAMAN 1: DASHBOARD EKSEKUTIF OWNER ───
  drawPageHeader(doc, "Panduan Manajerial: Dashboard Laba Rugi", "Executive Dashboard");

  let curY = 18;
  curY = drawSectionHeader(doc, curY, "1. Evaluasi Kinerja Finansial Kedai Secara Realtime", "Analisis Gross Sales, Net Sales, HPP/COGS, dan Laba Bersih.");

  const m1Y = curY;
  drawImageBox(doc, SCREEN_DASHBOARD, margin, m1Y, colW + 10, 50, "Gambar M.1: Dashboard Eksekutif Owner & Laporan Laba Rugi");

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2]);
  doc.text("Standar Rasio Finansial Julia's Coffee:", descX, m1Y + 4);

  const m1Ratios = [
    "• Net Sales: Total omzet bersih yang diterima kedai setelah dikurangi diskon.",
    "• COGS / HPP Bahan: Biaya bahan baku yang terpotong otomatis dari penjualan menu.",
    "  -> Standar Target Sehat: 28% s/d 35% dari Net Sales. Jika >38%, audit porsi resep!",
    "• Gross Profit: Laba kotor penjualan menu (Target Sehat: 65% - 72%).",
    "• Operating Expenses: Biaya operasional harian kas kecil (Target: maks 5-7%).",
    "• Net Profit Margin: Laba bersih akhir bagi Owner (Target Sehat: 20% - 30%)."
  ];
  m1Ratios.forEach((r, idx) => {
    const l = doc.splitTextToSize(r, descW);
    doc.text(l, descX, m1Y + 9 + idx * 5.8);
  });

  curY = m1Y + 58;
  curY = drawSectionHeader(doc, curY, "2. Matriks Otorisasi Supervisor (Pencegahan Kecurangan)");

  autoTable(doc, {
    startY: curY,
    head: [["Aksi Sensitif Kasir", "Role Berwenang", "Dampak Sistem & Audit Trail"]],
    body: [
      ["Void Pesanan (Pembatalan Struk)", "MANAGER, LEADER, SUPER_ADMIN", "Bahan baku otomatis dikembalikan ke stok gudang. Tercatat di Audit Log."],
      ["Refund Pembayaran Tamu", "MANAGER, SUPER_ADMIN", "Kasir mengembalikan uang tunai. Tercatat di pengeluaran kas shift."],
      ["Diskon Manual Khusus", "MANAGER, LEADER", "Mencegah kasir memberikan diskon sembarangan kepada kerabat tanpa izin."],
      ["Koreksi Stok Opname", "MANAGER, LEADER", "Penyesuaian kartu stok bahan baku dan pengakuan defisit/surplus HPP."]
    ],
    theme: "grid",
    headStyles: { fillColor: [180, 83, 9], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 6.5 },
    bodyStyles: { fontSize: 6, textColor: TEXT_DARK as any, cellPadding: 1.8 },
    columnStyles: {
      0: { cellWidth: 48, fontStyle: "bold" },
      1: { cellWidth: 44, fontStyle: "bold", textColor: ACCENT_BLUE as any },
      2: { cellWidth: 90 },
    },
    margin: { left: margin, right: margin },
  });

  drawPageFooter(doc, 1, totalPages);

  // ─── HALAMAN 2: MANAJEMEN INVENTORI & RESEP ───
  doc.addPage();
  drawPageHeader(doc, "Panduan Manajerial: Manajemen Resep & HPP", "Inventori & Resep");

  curY = 18;
  curY = drawSectionHeader(doc, curY, "3. Manajemen Bahan Baku & Resep Menu (BOM)", "Pengendalian porsi bahan agar HPP stabil dan rasa tidak berubah.");

  const m2Y = curY;
  drawImageBox(doc, SCREEN_INVENTORY, margin, m2Y, colW + 10, 52, "Gambar M.2: Layar Manajemen Stok & Resep Menu");

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2]);
  doc.text("Langkah Menambah / Mengubah Resep Menu:", descX, m2Y + 4);

  const m2Steps = [
    "1. Buka menu 'Manajemen Menu & Resep' di aplikasi.",
    "2. Pilih produk yang ingin diedit (misal: Kopi Susu Aren).",
    "3. Masukkan komposisi gramatur bahan baku (18g kopi, 120ml susu, 25ml aren).",
    "4. Sistem otomatis mengalkulasi total HPP dan margin keuntungan kotor.",
    "5. Klik 'Simpan Resep'. Setiap penjualan kasir akan memotong bahan sesuai formula ini."
  ];
  m2Steps.forEach((st, idx) => {
    const l = doc.splitTextToSize(st, descW);
    doc.text(l, descX, m2Y + 9 + idx * 7.5);
  });

  curY = m2Y + 60;
  curY = drawSectionHeader(doc, curY, "4. Audit Stok Opname Mingguan & Rekonsiliasi HPP");

  drawCaseStudyBox(
    doc,
    margin,
    curY,
    contentWidth,
    "Studi Kasus Opname Mingguan: Biji Kopi Selisih Minus 150g",
    "Leader Bar menimbang toples biji kopi sisa di bar. Timbangan menunjukkan 2.850 gram, sedangkan di sistem mencatat 3.000 gram.",
    [
      "Buka menu 'Inventori' -> Tab 'Stok Opname' -> Klik 'Mulai Sesi Opname'.",
      "Ketikkan angka fisik timbangan: 2.850 gram pada kolom Stok Fisik Aktual.",
      "Sistem menghitung selisih: -150 gr x Rp 250/gr = Defisit HPP -Rp 37.500.",
      "Manager mengisi keterangan: 'Selisih wajar dialing pagi' -> Klik 'Finalisasi Penyesuaian Stok'."
    ],
    "Saldo stok diperbarui menjadi 2.850 gr dan kerugian HPP Rp 37.500 dibukukan resmi tanpa merusak keseimbangan kas kedai."
  );

  drawPageFooter(doc, 2, totalPages);

  // ─── HALAMAN 3: PENGADAAN BAHAN (PO SUPPLIER) ───
  doc.addPage();
  drawPageHeader(doc, "Panduan Manajerial: Pengadaan Bahan (PO)", "Purchasing & Supplier");

  curY = 18;
  curY = drawSectionHeader(doc, curY, "5. Alur Pemesanan Bahan Baku ke Supplier (PO)", "Mencegah kehabisan bahan saat akhir pekan dan jam sibuk.");

  autoTable(doc, {
    startY: curY,
    head: [["Tahap", "Pelaksana", "Instruksi di Aplikasi", "Dampak Stok & Keuangan"]],
    body: [
      ["1. Cek Batas Minimum", "Leader Bar / Manager", "Lihat daftar bahan dengan status 'Stok Tipis' (Warna Kuning).", "Memicu kebutuhan pembelian segera."],
      ["2. Buat Draft PO", "Manager", "Pilih Supplier resmi -> Masukkan kuantitas (misal: 10 kg biji kopi) -> Klik Buat PO.", "Nomor PO resmi diterbitkan (#PO-0042)."],
      ["3. Terima Barang Fisik", "Leader Bar / Dapur", "Barang tiba -> Timbang berat kiriman -> Periksa kemasan dan tanggal sangrai.", "Memastikan kiriman utuh tanpa cacat."],
      ["4. Konfirmasi Penerimaan", "Manager", "Buka PO #PO-0042 -> Klik 'Terima Barang' -> Simpan.", "STOK GUDANG OTOMATIS BERTAMBAH."],
      ["5. Pembayaran Supplier", "Finance", "Catat pengeluaran kas via Bank BCA atau Petty Cash.", "Hutang dagang tertutup rapi."]
    ],
    theme: "grid",
    headStyles: { fillColor: ACCENT_BLUE as any, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 6.5 },
    bodyStyles: { fontSize: 6, textColor: TEXT_DARK as any, cellPadding: 1.8 },
    columnStyles: {
      0: { cellWidth: 32, fontStyle: "bold" },
      1: { cellWidth: 30 },
      2: { cellWidth: 70 },
      3: { cellWidth: 50, textColor: [4, 120, 87] },
    },
    margin: { left: margin, right: margin },
  });

  curY = (doc as any).lastAutoTable.finalY + 6;
  curY = drawSectionHeader(doc, curY, "6. Manajemen Kas Kecil (Petty Cash Operasional)");

  drawCaseStudyBox(
    doc,
    margin,
    curY,
    contentWidth,
    "Pembelian Es Batu Kristal Darurat Rp 25.000 via Kas Kecil",
    "Mesin es batu mengalami kendala teknis di jam sibuk. Kasir perlu membeli es batu kristal 5 kantong @Rp 5.000 (total Rp 25.000).",
    [
      "Buka menu Kas & Biaya -> Klik 'Catat Pengeluaran Petty Cash'.",
      "Pilih kategori: 'Operasional Harian - Es Batu' -> Masukkan nominal: Rp 25.000.",
      "Ketik keterangan: 'Beli es batu darurat 5 pack karena kompresor mesin es pendinginan'.",
      "Ambil uang tunai dari laci kasir -> Simpan struk pembelian fisik di map nota kasir."
    ],
    "Uang kas di laci kasir berkurang Rp 25.000 secara sah dan laporan kas malam otomatis memperhitungkan pengeluaran ini tanpa selisih."
  );

  drawPageFooter(doc, 3, totalPages);

  // ─── HALAMAN 4: PAYROLL GAJI & SLIP GAJI DIGITAL ───
  doc.addPage();
  drawPageHeader(doc, "Panduan Manajerial: Penggajian Karyawan", "HR & Payroll");

  curY = 18;
  curY = drawSectionHeader(doc, curY, "7. Penggajian Terintegrasi Presensi GPS & Insentif", "Perhitungan transparan berdasarkan jam kerja aktual dan capaian target omzet.");

  const m4Y = curY;
  drawImageBox(doc, SCREEN_PAYROLL, margin, m4Y, colW + 10, 48, "Gambar M.3: Layar Manajemen Payroll & Slip Gaji Karyawan");

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2]);
  doc.text("Komponen Gaji Karyawan Julia's:", descX, m4Y + 4);

  const payComponents = [
    "• Gaji Pokok / Harian: Dihitung dari jumlah presensi sah Clock-In GPS di area kedai.",
    "• Uang Makan & Transport: Tunjangan harian per kehadiran kerja.",
    "• Upah Lembur: Perhitungan otomatis tarif lembur per jam di atas 8 jam kerja.",
    "• Bonus Target Omzet: Insentif performa jika omzet bulanan kedai tembus target.",
    "• Potongan Kasbon: Pengurangan otomatis jika karyawan memiliki pinjaman aktif.",
    "• Slip Gaji PDF: Sekali klik terbit dokumen resmi dengan rincian Take Home Pay."
  ];
  payComponents.forEach((pc, idx) => {
    const l = doc.splitTextToSize(pc, descW);
    doc.text(l, descX, m4Y + 9 + idx * 6.5);
  });

  curY = m4Y + 56;
  curY = drawSectionHeader(doc, curY, "8. SOP Distribusi Slip Gaji Bulanan");

  drawCaseStudyBox(
    doc,
    margin,
    curY,
    contentWidth,
    "Penerbitan Slip Gaji Barista Budi (Periode Bulan Berjalan)",
    "Budi memiliki 26 hari kehadiran sah, 6 jam lembur saat event akhir pekan, dan berhak atas bonus omzet Rp 200.000.",
    [
      "Buka menu 'Payroll' -> Pilih periode bulan penggajian.",
      "Periksa rekap kehadiran Budi (26 hari masuk, 6 jam lembur terverifikasi Manager).",
      "Sistem mengalkulasi otomatis: Gaji Pokok + Uang Makan + Lembur + Bonus = Rp 3.250.000.",
      "Manager/Finance klik 'Generate Slip Gaji PDF' -> Unduh dokumen dan kirimkan via WhatsApp pribadi Budi."
    ],
    "Dokumen PDF resmi diterbitkan lengkap dengan logo Julia's Coffee, rincian potongan transparan, dan tanda terima digital sah."
  );

  drawPageFooter(doc, 4, totalPages);

  // ─── HALAMAN 5: AUDIT LOG & PROTOKOL RESET AMAN ───
  doc.addPage();
  drawPageHeader(doc, "Panduan Manajerial: Audit & Protokol Reset", "Keamanan & Maintenance");

  curY = 18;
  curY = drawSectionHeader(doc, curY, "9. Pemantauan Audit Trail & Investigasi Sistem", "Setiap aktivitas tercatat permanen dengan hash SHA-256 dan stempel waktu.");

  autoTable(doc, {
    startY: curY,
    head: [["Kategori Audit", "Data yang Direkam", "Tujuan Pengawasan Manager & Owner"]],
    body: [
      ["CASH_SHIFT", "Modal awal, uang aktual di laci, selisih rupiah, foto laci kasir.", "Memastikan tidak ada uang penjualan yang tidak disetor."],
      ["ORDER_VOID", "Nomor nota, daftar item yang dibatalkan, nama supervisor pemberi izin.", "Mencegah kasir membatalkan struk untuk mengambil uang tunai tamu."],
      ["INVENTORY_ADJ", "Perubahan gramatur stok manual, nilai rupiah HPP defisit, catatan alasan.", "Mencegah manipulasi stok bahan kopi dan susu."],
      ["PRICE_UPDATE", "Harga lama vs harga baru, waktu pergantian harga produk.", "Memastikan perubahan harga atas izin resmi Owner."]
    ],
    theme: "grid",
    headStyles: { fillColor: BRAND_NAVY as any, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 6.5 },
    bodyStyles: { fontSize: 6, textColor: TEXT_DARK as any, cellPadding: 1.8 },
    columnStyles: {
      0: { cellWidth: 38, fontStyle: "bold" },
      1: { cellWidth: 72 },
      2: { cellWidth: 72, textColor: [30, 58, 138] },
    },
    margin: { left: margin, right: margin },
  });

  curY = (doc as any).lastAutoTable.finalY + 6;
  curY = drawSectionHeader(doc, curY, "10. Protokol Reset Transaksi Sebelum Peluncuran (Go-Live)");

  drawCaseStudyBox(
    doc,
    margin,
    curY,
    contentWidth,
    "Prosedur Pembersihan Data Transaksi Uji Coba Awal Bulan",
    "Setelah tim selesai melakukan pengujian aplikasi selama masa training, seluruh nota pesanan dummy, kas uji coba, dan shift harus dibersihkan sebelum kedai dibuka untuk umum.",
    [
      "Login sebagai Super Admin (username: 'admin') -> Buka Pengaturan -> Pemeliharaan Database.",
      "Masukkan PIN Super Admin yang sah pada panel Reset Transaksi Uji Coba.",
      "Ketikkan teks konfirmasi wajib persis: 'HAPUS DATA UJI COBA'.",
      "Klik tombol merah 'Mulai Bersihkan Riwayat Transaksi'."
    ],
    "Seluruh pesanan dummy dan riwayat kasir dibersihkan 100% kembali ke 0. MASTER MENU, HARGA, RESEP, STOK GUDANG, DAN 9 AKUN USER TETAP AMAN UTUH."
  );

  drawPageFooter(doc, 5, totalPages);

  const outPath = path.join(process.cwd(), "public", "Panduan_Manajerial_Owner_dan_Manager.pdf");
  fs.writeFileSync(outPath, Buffer.from(doc.output("arraybuffer")));
  console.log(`[Manager Guide] Generated 5-page manual: ${outPath}`);
};

// Execute all generators
console.log("Starting full PDF generation with real screenshots and detailed cases...");
generateDetailedManualBook();
generateKasirKdsRoleGuide();
generateManagerOwnerRoleGuide();
console.log("All comprehensive guides generated successfully!");
