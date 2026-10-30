import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import fs from "fs";
import path from "path";

// Bulletproof jsPDF Constructor
const JsPDFConstructor: any =
  typeof jsPDF === "function" ? jsPDF : (jsPDF as any)?.default || jsPDF;

// Read Brand Logo
let logoBase64 = "";
try {
  const logoPath = path.join(process.cwd(), "public", "logo-client.png");
  if (fs.existsSync(logoPath)) {
    const buf = fs.readFileSync(logoPath);
    logoBase64 = `data:image/png;base64,${buf.toString("base64")}`;
  }
} catch (e) {
  console.warn("Could not load logo for PDF:", e);
}

// ── COLOR PALETTE ──
const BRAND_NAVY = [15, 23, 42];     // slate-900
const BRAND_AMBER = [245, 158, 11];  // amber-500
const BRAND_EMERALD = [5, 150, 105]; // emerald-600
const ACCENT_BLUE = [30, 58, 138];   // blue-900
const TEXT_DARK = [30, 41, 59];      // slate-800
const TEXT_MUTED = [100, 116, 139];  // slate-500
const BG_LIGHT = [248, 250, 252];    // slate-50
const BORDER_LIGHT = [226, 232, 240];// slate-200

// Helper to draw clean header banner
const drawHeaderBanner = (
  doc: any,
  title: string,
  subtitle: string,
  categoryBadge: string
) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  doc.setFillColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2]);
  doc.rect(0, 0, pageWidth, 42, "F");
  doc.setFillColor(BRAND_AMBER[0], BRAND_AMBER[1], BRAND_AMBER[2]);
  doc.rect(0, 40.8, pageWidth, 1.2, "F");

  // Logo if available
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, "PNG", margin, 7, 26, 26);
    } catch {}
  }

  const textStartX = logoBase64 ? margin + 30 : margin;

  // Category Badge
  doc.setFillColor(BRAND_AMBER[0], BRAND_AMBER[1], BRAND_AMBER[2]);
  doc.roundedRect(textStartX, 8, 48, 4.5, 1, 1, "F");
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2]);
  doc.text(categoryBadge.toUpperCase(), textStartX + 2, 11.2);

  // Title
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(title, textStartX, 19.5);

  // Subtitle
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(203, 213, 225);
  doc.text(subtitle, textStartX, 25.5);

  doc.setFontSize(6.8);
  doc.setTextColor(BRAND_AMBER[0], BRAND_AMBER[1], BRAND_AMBER[2]);
  doc.text(
    "Julia's Coffee & Eatery  •  Production Release v2.4.0  •  Edisi: November 2026",
    textStartX,
    31.5
  );
};

// Helper for subpage mini headers
const drawSubpageHeader = (doc: any, pageTitle: string, docLabel: string) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  doc.setFillColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2]);
  doc.rect(0, 0, pageWidth, 14, "F");
  doc.setFillColor(BRAND_AMBER[0], BRAND_AMBER[1], BRAND_AMBER[2]);
  doc.rect(0, 13.2, pageWidth, 0.8, "F");

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(pageTitle.toUpperCase(), margin, 9.5);

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(BRAND_AMBER[0], BRAND_AMBER[1], BRAND_AMBER[2]);
  doc.text(docLabel, pageWidth - margin, 9.5, { align: "right" });
};

// Helper to draw clean section titles
const drawSectionHeader = (
  doc: any,
  y: number,
  title: string,
  subtitle?: string
) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  doc.setFillColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2]);
  doc.rect(margin, y, contentWidth, 7, "F");
  doc.setFillColor(BRAND_AMBER[0], BRAND_AMBER[1], BRAND_AMBER[2]);
  doc.rect(margin, y, 2.5, 7, "F");

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(title.toUpperCase(), margin + 5, y + 5);

  if (subtitle) {
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
    doc.text(subtitle, margin, y + 11);
    return y + 14;
  }
  return y + 9.5;
};

// Helper to draw flowchart boxes
const drawFlowchartSteps = (
  doc: any,
  y: number,
  steps: { num: string; title: string; desc: string; actor: string }[]
) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const cardWidth = (contentWidth - (steps.length - 1) * 3) / steps.length;
  const cardHeight = 24;

  steps.forEach((step, i) => {
    const x = margin + i * (cardWidth + 3);

    // Box background
    doc.setFillColor(BG_LIGHT[0], BG_LIGHT[1], BG_LIGHT[2]);
    doc.setDrawColor(BORDER_LIGHT[0], BORDER_LIGHT[1], BORDER_LIGHT[2]);
    doc.roundedRect(x, y, cardWidth, cardHeight, 1.5, 1.5, "FD");

    // Header strip
    doc.setFillColor(ACCENT_BLUE[0], ACCENT_BLUE[1], ACCENT_BLUE[2]);
    doc.rect(x, y, cardWidth, 4.5, "F");

    // Number & Title
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(`${step.num}. ${step.title}`, x + 2, y + 3.3);

    // Actor badge
    doc.setFontSize(5.8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(BRAND_AMBER[0], BRAND_AMBER[1], BRAND_AMBER[2]);
    doc.text(`Pelaksana: ${step.actor}`, x + 2, y + 8);

    // Description text
    doc.setFontSize(6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
    const lines = doc.splitTextToSize(step.desc, cardWidth - 4);
    doc.text(lines.slice(0, 4), x + 2, y + 12);

    // Arrow indicator between steps
    if (i < steps.length - 1) {
      const arrowX = x + cardWidth + 0.8;
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(BRAND_AMBER[0], BRAND_AMBER[1], BRAND_AMBER[2]);
      doc.text("›", arrowX, y + cardHeight / 2 + 1);
    }
  });

  return y + cardHeight + 4;
};

// Helper for Footer
const drawFooter = (
  doc: any,
  pageNo: number,
  totalPages: number,
  docName: string
) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  doc.setDrawColor(BORDER_LIGHT[0], BORDER_LIGHT[1], BORDER_LIGHT[2]);
  doc.line(margin, pageHeight - 9, pageWidth - margin, pageHeight - 9);

  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
  doc.text(
    `Halaman ${pageNo} dari ${totalPages}  •  ${docName}  •  Dokumen Resmi Julia's Coffee & Eatery`,
    margin,
    pageHeight - 5
  );
  doc.text("Kerahasiaan Internal Terkendali", pageWidth - margin, pageHeight - 5, {
    align: "right",
  });
};

// ============================================================================
// DOKUMEN 1: BUKU PANDUAN KOMPREHENSIF LENGKAP (MASTER GUIDE)
// ============================================================================
const generateMasterGuide = () => {
  const doc = new JsPDFConstructor("p", "mm", "a4");
  const margin = 14;
  const contentWidth = doc.internal.pageSize.getWidth() - margin * 2;
  const totalPages = 4;

  // ─── HALAMAN 1: IDENTITAS, ROLE & ARSITEKTUR ───
  drawHeaderBanner(
    doc,
    "BUKU PANDUAN KOMPREHENSIF SISTEM",
    "Arsitektur Platform, Matriks 9 Role, Alur Operasional, SOP Inventori & Finansial",
    "Dokumen Induk Master"
  );

  let curY = 48;

  // Kotak Pengantar
  doc.setFillColor(BG_LIGHT[0], BG_LIGHT[1], BG_LIGHT[2]);
  doc.setDrawColor(BORDER_LIGHT[0], BORDER_LIGHT[1], BORDER_LIGHT[2]);
  doc.roundedRect(margin, curY, contentWidth, 19, 1.5, 1.5, "FD");

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2]);
  doc.text("STANDAR MUTU OPERASIONAL DIGITAL JULIA'S COFFEE:", margin + 3.5, curY + 5);

  doc.setFontSize(6.8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
  const intro =
    "Dokumen ini memuat standar operasional prosedur (SOP) digital terintegrasi untuk mendukung seluruh lini kerja Julia's Coffee & Eatery. " +
    "Aplikasi berjalan dengan arsitektur Hybrid Online/Offline (PWA Cache & Local Storage), didukung database PostgreSQL terpusat, " +
    "Kitchen Display System (KDS) multi-stasiun, dan modul Audit Trail berstandar keamanan enterprise.";
  doc.text(doc.splitTextToSize(intro, contentWidth - 7), margin + 3.5, curY + 9.5);

  curY += 23;

  // Matriks 9 Role (TANPA PIN POLOS!)
  curY = drawSectionHeader(
    doc,
    curY,
    "1. Matriks 9 Akun & Wewenang Pengguna (Struktur Tim Uji Coba)",
    "PIN akun bersifat rahasia perorangan dan didistribusikan langsung oleh Super Admin / Manajemen."
  );

  autoTable(doc, {
    startY: curY,
    head: [["Kode Role", "Username", "Nama Personel / Akun", "Departemen", "Cakupan Otoritas & Hak Akses Fitur"]],
    body: [
      ["SUPER_ADMIN", "admin", "Super Admin Julia's", "Management", "Akses 100% penuh: Pengaturan toko, reset sistem, audit log, user management."],
      ["OWNER", "owner", "Owner Julia's", "Executive", "Pengawasan eksekutif: Dashboard omzet, laba-rugi realtime, laporan payroll, audit log."],
      ["MANAGER", "manager", "Manager Operasional", "Operasional", "Otorisasi PIN Void/Refund, Approval Diskon, Kelola Stok, Pembelian PO, HR."],
      ["KASIR", "kasir", "Terminal Kasir POS", "Bar & Kasir", "Buka/tutup shift, transaksi meja, split bill, cetak thermal 80mm/58mm, kirim WA."],
      ["LEADER", "leader", "Rama (Leader Bar)", "BAR", "Supervisi stasiun bar, checklist kebersihan, stok opname bar, mutasi bahan, kalibrasi."],
      ["BAR", "barista", "Budi (Barista)", "BAR", "Layar KDS Barista, ubah status antrean pesanan minuman, presensi kehadiran GPS."],
      ["KITCHEN", "kitchen", "Chef Dapur", "KITCHEN", "Layar KDS Makanan, antrean masak, porsi resep dapur, pencatatan waste masakan."],
      ["BAKER", "baker", "Pastry Baker", "BAKERY", "Layar KDS Pastry/Croissant, baking batch, ketersediaan display showcase kue."],
      ["FINANCE", "finance", "Finance & Accounting", "Finance", "Buku kas operasional, petty cash, verifikasi pengeluaran, payroll, rekonsiliasi."]
    ],
    theme: "grid",
    headStyles: { fillColor: BRAND_NAVY as any, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 6.8 },
    bodyStyles: { fontSize: 6.3, textColor: TEXT_DARK as any, cellPadding: 1.4 },
    columnStyles: {
      0: { cellWidth: 24, fontStyle: "bold" },
      1: { cellWidth: 18, fontStyle: "bold", textColor: ACCENT_BLUE as any },
      2: { cellWidth: 32 },
      3: { cellWidth: 20 },
      4: { cellWidth: 88, textColor: [71, 85, 105] },
    },
    margin: { left: margin, right: margin },
  });

  curY = (doc as any).lastAutoTable.finalY + 5;

  // Keamanan Info Box
  doc.setFillColor(254, 243, 199);
  doc.setDrawColor(245, 158, 11);
  doc.roundedRect(margin, curY, contentWidth, 13, 1, 1, "FD");
  doc.setFontSize(6.8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(146, 64, 14);
  doc.text("PERINGATAN KEAMANAN & KEPATUHAN PIN:", margin + 3, curY + 4);
  doc.setFontSize(6.2);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 53, 15);
  doc.text(
    "Setiap staf dilarang keras membagikan PIN kepada staf lain. Setiap transaksi, pembatalan (void), dan perubahan stok " +
    "diaudit permanen dengan hash SHA-256 dan terhubung ke username pelaksana. PIN dapat diubah mandiri di menu Pengaturan Profil.",
    margin + 3,
    curY + 8
  );

  drawFooter(doc, 1, totalPages, "Buku Panduan Komprehensif");

  // ─── HALAMAN 2: FLOWCHART WORKFLOW OPERASIONAL HARIAN ───
  doc.addPage();
  drawSubpageHeader(doc, "Alur Kerja Operasional Harian Kedai", "Workflow End-to-End");

  curY = 20;
  curY = drawSectionHeader(
    doc,
    curY,
    "2. Flowchart Alur Operasional Kedai (Buka Shift hingga Tutup Buku)",
    "Tahapan berurutan yang wajib dipatuhi setiap pergantian hari operasional."
  );

  curY = drawFlowchartSteps(doc, curY, [
    { num: "01", title: "Buka Shift Kasir", actor: "Kasir & Leader", desc: "Presensi GPS, hitung modal laci (cash float), checklist kebersihan & kalibrasi grinder kopi." },
    { num: "02", title: "Input & Split Bill", actor: "Kasir POS", desc: "Pilih Dine In Meja / Takeaway, tentukan pesanan + modifier, diskon promo, split bill fleksibel." },
    { num: "03", title: "KDS Multi-Station", actor: "Barista / Chef / Baker", desc: "Tiket pesanan otomatis terpisah ke Bar, Kitchen, Bakery. Staf update status Cooking -> Ready." },
    { num: "04", title: "Bayar & Struk", actor: "Kasir POS", desc: "Pembayaran Cash / QRIS / Transfer. Struk thermal otomatis tercetak + opsi kirim PDF via WhatsApp." },
    { num: "05", title: "Tutup Shift & Z-Rep", actor: "Kasir & Manager", desc: "Hitung fisik kas aktual di laci, verifikasi selisih, approval PIN Manager, cetak Z-Report harian." }
  ]);

  curY += 2;

  // Detail Tabel Penjelasan Workflow
  autoTable(doc, {
    startY: curY,
    head: [["Tahap", "Pelaksana", "Instruksi Teknis Aplikasi", "Dampak Data & Keuangan Sistem"]],
    body: [
      [
        "Pagi: Persiapan",
        "Kasir & Leader Bar",
        "1. Login akun 'kasir' -> Menu POS -> Klik 'Buka Shift'.\n2. Masukkan Modal Awal (default Rp 300.000).\n3. Barista isi checklist kalibrasi shot espresso di menu Kalibrasi.",
        "• Laci kasir terdaftar aktif.\n• Stok biji kopi kalibrasi terpotong sebagai waste resmi.\n• Mesin siap terima transaksi."
      ],
      [
        "Siang: Pelayanan",
        "Kasir & Bar/Kitchen",
        "1. Terima pesanan meja tamu, klik 'Kirim Pesanan'.\n2. Pesanan langsung tampil di layar /kds masing-masing divisi.\n3. Barista klik 'Proses' lalu 'Selesai' saat minuman siap antar.",
        "• Bahan baku resep terpotong realtime.\n• Tamu dilayani cepat tanpa bon kertas hilang.\n• Waktu tunggu tercatat transparan."
      ],
      [
        "Malam: Tutup Shift",
        "Kasir & Manager",
        "1. Klik tombol 'Tutup Shift' di POS.\n2. Hitung fisik uang kertas & koin di laci kasir.\n3. Masukkan total fisik aktual -> Sistem hitung selisih lunas/kurang.\n4. Cetak struk Z-Report & kunci sesi.",
        "• Selisih kas langsung tercatat di Audit Log.\n• Transaksi hari itu terkunci (final).\n• Rekap omzet tunai & QRIS terpisah rapi."
      ]
    ],
    theme: "grid",
    headStyles: { fillColor: ACCENT_BLUE as any, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 6.8 },
    bodyStyles: { fontSize: 6.3, textColor: TEXT_DARK as any, cellPadding: 1.8 },
    columnStyles: {
      0: { cellWidth: 26, fontStyle: "bold" },
      1: { cellWidth: 26, fontStyle: "bold" },
      2: { cellWidth: 78 },
      3: { cellWidth: 52, textColor: [4, 120, 87] },
    },
    margin: { left: margin, right: margin },
  });

  drawFooter(doc, 2, totalPages, "Buku Panduan Komprehensif");

  // ─── HALAMAN 3: RESEP, INVENTORI & AUDIT STOK OPNAME ───
  doc.addPage();
  drawSubpageHeader(doc, "Manajemen Stok, Resep & Keuangan", "Inventori & Finansial");

  curY = 20;
  curY = drawSectionHeader(
    doc,
    curY,
    "3. Standar Resep & Deduksi Otomatis Bahan Baku (BOM)",
    "Setiap menu terjual memotong gramatur bahan baku secara presisi untuk kontrol HPP."
  );

  autoTable(doc, {
    startY: curY,
    head: [["Nama Produk Terjual", "Komposisi Bahan Baku (Resep)", "Stok Terpotong", "HPP Satuan (Rp)"]],
    body: [
      ["Kopi Susu Aren Signature (Cup)", "House Blend Espresso, Fresh Milk Greenfields, Gula Aren Racikan, Es Batu Tube", "18 gr kopi + 120 ml susu + 25 ml aren + 120 gr es batu", "Rp 6.850 / cup"],
      ["Americano Iced (Cup)", "House Blend Espresso Beans, Air RO Bersih, Es Batu Tube Kristal", "18 gr kopi + 150 ml air + 150 gr es batu", "Rp 4.750 / cup"],
      ["Butter Croissant Fresh", "Adonan Butter Pastry Frozen, Olesan Kuning Telur", "1 pcs adonan butter pastry batch", "Rp 9.200 / pcs"],
      ["Nasi Goreng Special Julia", "Beras Pulen, Minyak, Telur Ayam, Bumbu Racik Dapur, Suwir Ayam", "150 gr beras + 1 butir telur + 50 gr ayam + porsi bumbu", "Rp 11.500 / porsi"]
    ],
    theme: "grid",
    headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 6.8 },
    bodyStyles: { fontSize: 6.3, textColor: TEXT_DARK as any, cellPadding: 1.5 },
    columnStyles: {
      0: { cellWidth: 42, fontStyle: "bold" },
      1: { cellWidth: 78 },
      2: { cellWidth: 38 },
      3: { cellWidth: 24, halign: "right", fontStyle: "bold" },
    },
    margin: { left: margin, right: margin },
  });

  curY = (doc as any).lastAutoTable.finalY + 6;

  curY = drawSectionHeader(
    doc,
    curY,
    "4. Prosedur Audit Stok Opname (Hitung Fisik Mingguan)",
    "Mekanisme penyesuaian saldo gudang dan deteksi dini selisih atau kebocoran bahan."
  );

  autoTable(doc, {
    startY: curY,
    head: [["Langkah Opname", "Instruksi Pelaksanaan di Menu Inventori", "Rumus & Konsekuensi Akuntansi"]],
    body: [
      [
        "1. Buka Sesi Opname",
        "Leader Bar / Manager masuk ke menu 'Inventori' -> klik tab 'Stok Opname' -> 'Mulai Sesi Opname Baru'.",
        "Sistem membekukan saldo buku sementara agar penghitungan akurat."
      ],
      [
        "2. Timbang Fisik",
        "Timbang seluruh sisa biji kopi (gr), ukur susu sisa (ml), hitung cup/kemasan (pcs) di bar & chiller.",
        "Input angka riil timbangan ke kolom 'Stok Fisik Aktual'."
      ],
      [
        "3. Verifikasi Selisih",
        "Sistem otomatis menampilkan selisih: Hijau (+ surplus), Merah (- defisit / hilang).",
        "Selisih = Stok Fisik - Stok Sistem.\nNilai Defisit = Selisih (-) x Harga Beli Terakhir."
      ],
      [
        "4. Finalisasi Stok",
        "Manager memasukkan catatan alasan selisih (misal: kalibrasi tidak tercatat) lalu klik 'Finalisasi Penyesuaian'.",
        "Kartu stok otomatis terkoreksi dan nilai kerugian masuk ke Jurnal Penyesuaian HPP."
      ]
    ],
    theme: "grid",
    headStyles: { fillColor: BRAND_NAVY as any, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 6.8 },
    bodyStyles: { fontSize: 6.3, textColor: TEXT_DARK as any, cellPadding: 1.5 },
    columnStyles: {
      0: { cellWidth: 30, fontStyle: "bold" },
      1: { cellWidth: 92 },
      2: { cellWidth: 60, textColor: [180, 83, 9] },
    },
    margin: { left: margin, right: margin },
  });

  drawFooter(doc, 3, totalPages, "Buku Panduan Komprehensif");

  // ─── HALAMAN 4: LAPORAN EKSEKUTIF, RESET AMAN & KESIAPAN UJI COBA ───
  doc.addPage();
  drawSubpageHeader(doc, "Administrasi Sistem & Kesiapan Uji Coba", "Manajemen & Pemeliharaan");

  curY = 20;
  curY = drawSectionHeader(
    doc,
    curY,
    "5. Prosedur Reset Data Uji Coba (Clean Slate Sebelum Go-Live)",
    "Fasilitas pembersihan riwayat transaksi uji coba tanpa merusak master produk, harga, resep, atau user."
  );

  autoTable(doc, {
    startY: curY,
    head: [["Komponen Data", "Status Saat Reset Transaksi", "Keterangan Keamanan & Integritas"]],
    body: [
      ["Master Produk, Varian & Kategori", "DIJAGA 100% AMAN (TIDAK DIHAPUS)", "Daftar menu kopi, makanan, modifier harga tetap utuh siap pakai."],
      ["Daftar Resep & Bahan Baku (BOM)", "DIJAGA 100% AMAN (TIDAK DIHAPUS)", "Formula resep, satuan gramatur & supplier bahan tetap tersimpan."],
      ["Akun Staf & Role Pengguna", "DIJAGA 100% AMAN (TIDAK DIHAPUS)", "9 akun tim uji coba tetap aktif dengan hak akses masing-masing."],
      ["Riwayat Order & Pembayaran Uji Coba", "DIRESET BERSIH (0 TRANSAKSI)", "Semua nota pesanan, split bill & pembayaran dummy terhapus bersih."],
      ["Shift Kasir & Saldo Kas Uji Coba", "DIRESET BERSIH", "Seluruh riwayat buka/tutup shift kasir kembali ke status awal bersih."],
      ["Audit Log & Pengeluaran Kas Dummy", "DIRESET BERSIH", "Jurnal kas kecil & catatan audit dummy dibersihkan menyambut hari pertama."]
    ],
    theme: "grid",
    headStyles: { fillColor: [185, 28, 28], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 6.8 },
    bodyStyles: { fontSize: 6.3, textColor: TEXT_DARK as any, cellPadding: 1.5 },
    columnStyles: {
      0: { cellWidth: 46, fontStyle: "bold" },
      1: { cellWidth: 50, fontStyle: "bold" },
      2: { cellWidth: 86, textColor: [71, 85, 105] },
    },
    margin: { left: margin, right: margin },
  });

  curY = (doc as any).lastAutoTable.finalY + 6;

  // Syarat Reset Box
  doc.setFillColor(254, 242, 242);
  doc.setDrawColor(239, 68, 68);
  doc.roundedRect(margin, curY, contentWidth, 18, 1.5, 1.5, "FD");

  doc.setFontSize(7.2);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(153, 27, 27);
  doc.text("3 LAPIS PENGAMAN RESET TRANSAKSI:", margin + 3.5, curY + 4.5);

  doc.setFontSize(6.3);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(127, 29, 29);
  const resetRules =
    "1. Wajib Sesi Login Aktif dengan Role SUPER_ADMIN (Tidak dapat dipanggil oleh publik atau kasir).\n" +
    "2. Wajib Memasukkan PIN Super Admin yang sah (Terverifikasi hash SHA-256 di server backend).\n" +
    "3. Wajib Konfirmasi Teks Persis: 'HAPUS DATA UJI COBA' untuk mencegah salah pencet tidak sengaja.";
  doc.text(resetRules, margin + 3.5, curY + 8.5);

  curY += 24;

  // Lembar Pengesahan
  curY = drawSectionHeader(doc, curY, "6. Lembar Persetujuan & Kesiapan Uji Coba");

  const signBoxWidth = (contentWidth - 6) / 3;
  const signY = curY + 2;

  const signRoles = [
    { title: "Disusun Oleh:", role: "Super Admin / Pengembang", name: "Tim Teknis Julia's POS" },
    { title: "Ditinjau Oleh:", role: "Manager Operasional", name: "Manager Julia's Coffee" },
    { title: "Disetujui Oleh:", role: "Owner / Direksi", name: "Owner Julia's Coffee & Eatery" },
  ];

  signRoles.forEach((s, idx) => {
    const sx = margin + idx * (signBoxWidth + 3);
    doc.setFillColor(BG_LIGHT[0], BG_LIGHT[1], BG_LIGHT[2]);
    doc.setDrawColor(BORDER_LIGHT[0], BORDER_LIGHT[1], BORDER_LIGHT[2]);
    doc.roundedRect(sx, signY, signBoxWidth, 22, 1, 1, "FD");

    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
    doc.text(s.title, sx + 3, signY + 4);

    doc.setFontSize(6.8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2]);
    doc.text(s.role, sx + 3, signY + 8);

    doc.setDrawColor(BORDER_LIGHT[0], BORDER_LIGHT[1], BORDER_LIGHT[2]);
    doc.line(sx + 3, signY + 16, sx + signBoxWidth - 3, signY + 16);

    doc.setFontSize(6.2);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
    doc.text(s.name, sx + 3, signY + 19.5);
  });

  drawFooter(doc, 4, totalPages, "Buku Panduan Komprehensif");

  const outPath = path.join(process.cwd(), "public", "Buku_Panduan_Lengkap_Julia_Coffee.pdf");
  fs.writeFileSync(outPath, Buffer.from(doc.output("arraybuffer")));
  console.log(`[Master Guide] Created: ${outPath}`);
};

// ============================================================================
// DOKUMEN 2: PANDUAN OPERASIONAL KASIR & KDS (FRONT & BACK OF HOUSE)
// ============================================================================
const generateKasirKdsGuide = () => {
  const doc = new JsPDFConstructor("p", "mm", "a4");
  const margin = 14;
  const contentWidth = doc.internal.pageSize.getWidth() - margin * 2;
  const totalPages = 3;

  // ─── HALAMAN 1: PANDUAN LENGKAP KASIR POS ───
  drawHeaderBanner(
    doc,
    "PANDUAN OPERASIONAL KASIR & KDS",
    "Petunjuk Praktis Buka Shift, Transaksi Meja, Split Bill, Struk Thermal & KDS Dapur",
    "SOP Kasir, Barista & Dapur"
  );

  let curY = 48;

  curY = drawSectionHeader(
    doc,
    curY,
    "1. Alur Transaksi Kasir POS (Langkah demi Langkah)",
    "Ikuti alur ini untuk memastikan pencatatan kas, inventori, dan tiket dapur berjalan sempurna."
  );

  curY = drawFlowchartSteps(doc, curY, [
    { num: "01", title: "Buka Shift", actor: "Kasir", desc: "Klik POS -> Buka Shift. Input modal kas awal (mis. Rp 300rb)." },
    { num: "02", title: "Pilih Meja", actor: "Kasir", desc: "Pilih Dine In (Nomor Meja) atau Take Away (Bungkus)." },
    { num: "03", title: "Input Menu", actor: "Kasir", desc: "Sentuh item, pilih varian/gula/es, masukkan diskon promo." },
    { num: "04", title: "Bayar / Simpan", actor: "Kasir", desc: "Kirim ke KDS atau langsung bayar (CASH / QRIS / Transfer)." },
    { num: "05", title: "Cetak Nota", actor: "Kasir", desc: "Printer thermal 80mm cetak struk + kirim PDF WhatsApp." }
  ]);

  curY += 2;

  // Tabel Detail Transaksi Kasir
  autoTable(doc, {
    startY: curY,
    head: [["Situasi Pelanggan", "Instruksi Tindakan di Layar Kasir", "Solusi Cepat & SOP"]],
    body: [
      [
        "Tamu Duduk (Dine In) Mau Pesan Bertahap",
        "1. Klik tab 'Dine In' -> Pilih No Meja (contoh: Meja 08).\n2. Pilih pesanan pertama -> Klik tombol 'Simpan Meja / Open Bill'.\n3. Saat tamu pesan lagi, buka daftar 'Bill Meja' -> Meja 08 -> Tambah item.",
        "Pesanan langsung otomatis muncul di KDS Barista & Dapur seketika."
      ],
      [
        "Split Bill (Satu Meja Minta Bayar Terpisah)",
        "1. Buka Meja aktif di POS -> Klik tombol 'Split Bill'.\n2. Pilih mode: 'Pecah Menu' (pilih item tertentu) atau 'Bagi Rata'.\n3. Selesaikan pembayaran pertama. Sisa tagihan tetap tersimpan di Meja 08.",
        "Sistem menjamin total tagihan terbagi akurat tanpa selisih Rp."
      ],
      [
        "Pelanggan Minta Batalkan Menu (Void)",
        "1. Klik tombol 'Riwayat / Void' -> Pilih nomor nota pesanan.\n2. Klik 'Void Item' atau 'Void Pesanan'. Layar meminta PIN Supervisor.\n3. Panggil Leader/Manager untuk memasukkan PIN Otorisasi & alasan.",
        "Kasir tidak bisa void sendiri tanpa otorisasi PIN Manager/Leader."
      ],
      [
        "Internet Kedai Mati Tiba-tiba",
        "1. Tetap gunakan POS seperti biasa (Mode Offline PWA aktif otomatis).\n2. Terima pembayaran TUNAI (Cash) -> Struk cetak normal.\n3. Saat Wi-Fi menyala kembali, klik 'Sync Transaksi' di pojok atas.",
        "Uang tunai aman, stok lokal tercatat, sinkron otomatis saat online."
      ]
    ],
    theme: "grid",
    headStyles: { fillColor: BRAND_NAVY as any, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 6.8 },
    bodyStyles: { fontSize: 6.3, textColor: TEXT_DARK as any, cellPadding: 1.8 },
    columnStyles: {
      0: { cellWidth: 42, fontStyle: "bold" },
      1: { cellWidth: 88 },
      2: { cellWidth: 52, textColor: [180, 83, 9] },
    },
    margin: { left: margin, right: margin },
  });

  drawFooter(doc, 1, totalPages, "Panduan Operasional Kasir & KDS");

  // ─── HALAMAN 2: LAYAR DAPUR KDS & BARISTA ───
  doc.addPage();
  drawSubpageHeader(doc, "Layar Dapur KDS & Barista", "Alur Tiket & Penyajian");

  curY = 20;
  curY = drawSectionHeader(
    doc,
    curY,
    "2. Prosedur Layar Kitchen Display System (KDS)",
    "Akses langsung via URL: /kds pada tablet stasiun Barista, Dapur, dan Pastry."
  );

  autoTable(doc, {
    startY: curY,
    head: [["Stasiun KDS", "Personel", "Jenis Menu yang Diterima", "Aksi di Layar Tablet KDS"]],
    body: [
      [
        "KDS BARISTA\n(Station Bar)",
        "Barista (Budi) &\nLeader (Rama)",
        "Espresso, Kopi Susu Aren, Manual Brew, Latte, Tea, Mocktails, Minuman Dingin/Panas.",
        "1. Tiket baru berwarna MERAH (Antrean).\n2. Barista sentuh tiket -> Berubah KUNING (Sedang Dibuat).\n3. Minuman selesai -> Sentuh 'SELESAI' -> Hijau."
      ],
      [
        "KDS KITCHEN\n(Station Dapur)",
        "Chef Dapur &\nCook Helper",
        "Nasi Goreng, Rice Bowl, Pasta, French Fries, Snack Platter, Main Course hangat.",
        "1. Koki melihat rincian modifier (misal: 'Level Pedas 3, No Bawang').\n2. Makanan matang -> Sentuh 'SIAP SERVE' untuk kasir/waiter."
      ],
      [
        "KDS BAKERY\n(Station Pastry)",
        "Baker &\nPastry Chef",
        "Croissant, Danishes, Bagel, Cake Showcase, Toasted Pastry.",
        "1. Cek pesanan pastry hangat atau slice cake.\n2. Sentuh 'READY' agar barista/waiter dapat mengambil di showcase."
      ]
    ],
    theme: "grid",
    headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 6.8 },
    bodyStyles: { fontSize: 6.3, textColor: TEXT_DARK as any, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 32, fontStyle: "bold" },
      1: { cellWidth: 28, fontStyle: "bold" },
      2: { cellWidth: 62 },
      3: { cellWidth: 60, textColor: [4, 120, 87] },
    },
    margin: { left: margin, right: margin },
  });

  curY = (doc as any).lastAutoTable.finalY + 6;

  curY = drawSectionHeader(
    doc,
    curY,
    "3. Standar Kalibrasi Grinder & Pencatatan Waste Barista",
    "Wajib diisi setiap pagi sebelum kedai buka untuk memastikan rasa konsisten & kontrol HPP."
  );

  autoTable(doc, {
    startY: curY,
    head: [["Aktivitas Barista", "Langkah Input di Aplikasi POS", "Standar Rasa & Parameter Mesin"]],
    body: [
      [
        "Kalibrasi Espresso Pagi",
        "1. Masuk menu 'Kalibrasi & Waste' di POS.\n2. Masukkan gramatur biji terbuang saat dialing (misal: 36 gr kopi).\n3. Catat waktu ekstraksi (Detik) dan yield (Gram).",
        "Target Espresso Julia's:\nDose: 18.0 gr | Yield: 36.0 gr\nTime: 26 - 30 detik | Rasio 1:2"
      ],
      [
        "Waste Susu / Tumpah (Spill)",
        "1. Jika ada susu pecah, salah tuang, atau tumpah.\n2. Pilih bahan 'Fresh Milk Greenfields' -> Masukkan ml terbuang.\n3. Pilih alasan: 'Salah Pembuatan (Human Error)' atau 'Kualitas Rusak'.",
        "Biaya HPP susu otomatis tercatat transparan sebagai kerugian operasional."
      ]
    ],
    theme: "grid",
    headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 6.8 },
    bodyStyles: { fontSize: 6.3, textColor: TEXT_DARK as any, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 38, fontStyle: "bold" },
      1: { cellWidth: 84 },
      2: { cellWidth: 60, textColor: [180, 83, 9] },
    },
    margin: { left: margin, right: margin },
  });

  drawFooter(doc, 2, totalPages, "Panduan Operasional Kasir & KDS");

  // ─── HALAMAN 3: TUTUP SHIFT, REKONSILIASI KAS & STRUK Z-REPORT ───
  doc.addPage();
  drawSubpageHeader(doc, "Prosedur Tutup Shift Kasir", "Rekonsiliasi Kas & Z-Report");

  curY = 20;
  curY = drawSectionHeader(
    doc,
    curY,
    "4. Prosedur Tutup Shift Kasir Malam (Z-Report End of Day)",
    "Tahap akhir penutupan kasir yang wajib disaksikan oleh Leader atau Manager."
  );

  curY = drawFlowchartSteps(doc, curY, [
    { num: "01", title: "Klik Tutup Shift", actor: "Kasir", desc: "Buka menu POS, sentuh 'Tutup Shift' di pojok kanan atas." },
    { num: "02", title: "Hitung Kas Fisik", actor: "Kasir & Leader", desc: "Keluarkan seluruh uang dari laci, hitung nominal lembar & koin." },
    { num: "03", title: "Input Kas Aktual", actor: "Kasir", desc: "Ketik total uang fisik yang dihitung ke kolom Uang Aktual." },
    { num: "04", title: "Verifikasi Selisih", actor: "Leader / Mgr", desc: "Sistem tampilkan selisih (Rp 0 = Seimbang / Lunas)." },
    { num: "05", title: "Cetak Z-Report", actor: "Kasir", desc: "Cetak slip Z-Report thermal & simpan bersama fisik uang." }
  ]);

  curY += 2;

  autoTable(doc, {
    startY: curY,
    head: [["Komponen Perhitungan Z-Report", "Rumus Sistem POS", "Tindakan Jika Terjadi Selisih"]],
    body: [
      [
        "Total Kas Yang Seharusnya Ada di Laci",
        "Modal Awal + Penjualan Tunai - Pengeluaran Kas Kasir",
        "Sistem menghitung otomatis dari seluruh struk tunai yang terbit."
      ],
      [
        "Jika Uang Fisik Lebih Banyak (Selisih Lebih)",
        "Uang Fisik Aktual > Saldo Sistem POS",
        "Wajib dicatat sebagai 'Kas Lebih' di catatan shift. Cek apakah ada kembalian tamu yang tertinggal."
      ],
      [
        "Jika Uang Fisik Kurang (Selisih Kurang)",
        "Uang Fisik Aktual < Saldo Sistem POS",
        "Wajib diinvestigasi bersama Leader/Manager. Catat di Audit Shift untuk pertanggungjawaban kasir."
      ]
    ],
    theme: "grid",
    headStyles: { fillColor: BRAND_NAVY as any, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 6.8 },
    bodyStyles: { fontSize: 6.3, textColor: TEXT_DARK as any, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 54, fontStyle: "bold" },
      1: { cellWidth: 70 },
      2: { cellWidth: 58, textColor: [185, 28, 28] },
    },
    margin: { left: margin, right: margin },
  });

  curY = (doc as any).lastAutoTable.finalY + 8;

  // Catatan Printer Thermal
  doc.setFillColor(238, 242, 255);
  doc.setDrawColor(99, 102, 241);
  doc.roundedRect(margin, curY, contentWidth, 20, 1.5, 1.5, "FD");

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(49, 46, 129);
  doc.text("PANDUAN KONEKSI PRINTER THERMAL (80mm & 58mm):", margin + 3.5, curY + 5);

  doc.setFontSize(6.4);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(55, 48, 163);
  const printerTips =
    "• Printer USB/LAN: Hubungkan printer ke tablet/PC kasir, buka POS -> klik ikon Printer -> pilih Direct Print ESC/POS.\n" +
    "• Printer Bluetooth: Pasangkan (pair) printer di Bluetooth perangkat, lalu pilih printer di menu pengaturan POS.\n" +
    "• Kirim Struk WhatsApp: Masukkan nomor HP pelanggan saat checkout, struk digital PDF langsung terkirim otomatis.";
  doc.text(printerTips, margin + 3.5, curY + 9.5);

  drawFooter(doc, 3, totalPages, "Panduan Operasional Kasir & KDS");

  const outPath = path.join(process.cwd(), "public", "Panduan_Operasional_Kasir_dan_KDS.pdf");
  fs.writeFileSync(outPath, Buffer.from(doc.output("arraybuffer")));
  console.log(`[Kasir Guide] Created: ${outPath}`);
};

// ============================================================================
// DOKUMEN 3: PANDUAN MANAJERIAL OWNER & MANAGER (EXECUTIVE & FINANCIAL)
// ============================================================================
const generateManagerOwnerGuide = () => {
  const doc = new JsPDFConstructor("p", "mm", "a4");
  const margin = 14;
  const contentWidth = doc.internal.pageSize.getWidth() - margin * 2;
  const totalPages = 3;

  // ─── HALAMAN 1: DASHBOARD EKSEKUTIF, HPP & LABA RUGI ───
  drawHeaderBanner(
    doc,
    "PANDUAN MANAJERIAL OWNER & MANAGER",
    "Monitoring Laba-Rugi Realtime, Otorisasi PIN, Stok Opname, Payroll & Pengendalian Biaya",
    "SOP Eksekutif & Keuangan"
  );

  let curY = 48;

  curY = drawSectionHeader(
    doc,
    curY,
    "1. Dashboard Eksekutif & Analisis Laba-Rugi (P&L Realtime)",
    "Pantau kesehatan finansial kedai secara langsung dari perangkat Owner dan Manager."
  );

  autoTable(doc, {
    startY: curY,
    head: [["Indikator Keuangan", "Arti & Sumber Data", "Standar Target Sehat Kedai Kopi"]],
    body: [
      [
        "Gross Sales (Omzet Kotor)",
        "Total seluruh tagihan pesanan sebelum diskon dan sebelum potongan.",
        "Tren harian stabil atau meningkat di jam sibuk (peak hours)."
      ],
      [
        "Net Sales (Omzet Bersih)",
        "Gross Sales dikurangi Diskon Promo dan Potongan Meja.",
        "Uang riil yang masuk dari penjualan kopi & makanan."
      ],
      [
        "COGS / HPP (Harga Pokok Penjualan)",
        "Total biaya bahan baku yang terpotong otomatis dari resep menu terjual.",
        "Target Sehat: 28% - 35% dari Net Sales. Jika >38%, audit porsi resep!"
      ],
      [
        "Gross Profit (Laba Kotor)",
        "Net Sales dikurangi HPP Bahan Baku.",
        "Target Sehat: 65% - 72% dari Net Sales."
      ],
      [
        "Petty Cash & Beban Operasional",
        "Biaya operasional harian (es batu darurat, gas, sabun, kantong kresek).",
        "Target: Tidak melebihi plafon kas kecil mingguan (maks 5-7%)."
      ],
      [
        "Net Profit (Laba Bersih Est.)",
        "Laba Kotor dikurangi Beban Operasional & Estimasi Gaji Karyawan.",
        "Target Sehat: 20% - 30% Net Profit Margin bersih bagi Owner."
      ]
    ],
    theme: "grid",
    headStyles: { fillColor: BRAND_NAVY as any, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 6.8 },
    bodyStyles: { fontSize: 6.3, textColor: TEXT_DARK as any, cellPadding: 1.6 },
    columnStyles: {
      0: { cellWidth: 46, fontStyle: "bold" },
      1: { cellWidth: 78 },
      2: { cellWidth: 58, textColor: [4, 120, 87], fontStyle: "bold" },
    },
    margin: { left: margin, right: margin },
  });

  curY = (doc as any).lastAutoTable.finalY + 6;

  curY = drawSectionHeader(
    doc,
    curY,
    "2. Sistem Otorisasi PIN Manager (Supervisor Control)",
    "Tindakan berisiko tinggi wajib memasukkan PIN Supervisor untuk mencegah kecurangan (fraud)."
  );

  autoTable(doc, {
    startY: curY,
    head: [["Tindakan Kasir Berisiko", "Syarat Otorisasi PIN", "Dampak Audit Trail Sistem"]],
    body: [
      [
        "Void Pesanan (Pembatalan Struk)",
        "Wajib PIN Role MANAGER, LEADER, atau SUPER_ADMIN.",
        "Terekam di Audit Log: Nama kasir, nama manager yang acc, alasan pembatalan, dan jam transaksi."
      ],
      [
        "Refund Pembayaran Tamu",
        "Wajib PIN Role MANAGER atau SUPER_ADMIN.",
        "Kas dikembalikan ke pelanggan, pengeluaran kas tercatat di laporan kas harian."
      ],
      [
        "Pemberian Diskon Manual Khusus",
        "Diskon di luar promo resmi membutuhkan persetujuan Manager.",
        "Mencegah kasir memberikan diskon sembarangan kepada rekanan tanpa izin."
      ],
      [
        "Koreksi Saldo Stok Opname",
        "Wajib difinalisasi oleh MANAGER atau LEADER.",
        "Perubahan stok tercatat sebagai kartu stok audit berstempel waktu."
      ]
    ],
    theme: "grid",
    headStyles: { fillColor: [180, 83, 9], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 6.8 },
    bodyStyles: { fontSize: 6.3, textColor: TEXT_DARK as any, cellPadding: 1.6 },
    columnStyles: {
      0: { cellWidth: 46, fontStyle: "bold" },
      1: { cellWidth: 62 },
      2: { cellWidth: 74, textColor: [71, 85, 105] },
    },
    margin: { left: margin, right: margin },
  });

  drawFooter(doc, 1, totalPages, "Panduan Manajerial Owner & Manager");

  // ─── HALAMAN 2: PENGADAAN BAHAN (PO), OPNAME & PAYROLL ───
  doc.addPage();
  drawSubpageHeader(doc, "Pengadaan Bahan, Opname & Payroll", "Operasional Manajerial");

  curY = 20;
  curY = drawSectionHeader(
    doc,
    curY,
    "3. Alur Pengadaan Bahan Baku (Purchase Order & Penerimaan Barang)",
    "Standar pembelian biji kopi, susu, dan bahan dapur ke supplier resmi."
  );

  curY = drawFlowchartSteps(doc, curY, [
    { num: "01", title: "Cek Minimum Stok", actor: "Leader Bar", desc: "Sistem beri notifikasi kuning jika stok mendekati batas minimum." },
    { num: "02", title: "Buat Draft PO", actor: "Manager", desc: "Buat pesanan pembelian ke supplier dengan harga satuan disepakati." },
    { num: "03", title: "Terima Barang", actor: "Leader / Dapur", desc: "Cek fisik kiriman, timbang barang, verifikasi kesesuaian faktur." },
    { num: "04", title: "Input Saldo Masuk", actor: "Manager", desc: "Klik 'Terima Barang' -> Stok gudang bertambah otomatis." },
    { num: "05", title: "Pembayaran Supplier", actor: "Finance", desc: "Catat pembayaran via Petty Cash atau Transfer Rekening Bank." }
  ]);

  curY += 2;

  curY = drawSectionHeader(
    doc,
    curY,
    "4. Penggajian Karyawan & Slip Gaji Digital (Payroll Staf)",
    "Perhitungan gaji terintegrasi presensi GPS, lembur, dan bonus kedai."
  );

  autoTable(doc, {
    startY: curY,
    head: [["Komponen Gaji Staf", "Metode Perhitungan di Sistem", "Keterangan Disiplin & Insentif"]],
    body: [
      [
        "Gaji Pokok / Harian",
        "Dihitung berdasarkan jumlah kehadiran sah dari presensi Clock-In/Clock-Out GPS.",
        "Karyawan wajib presensi di area kedai dengan radius GPS terverifikasi."
      ],
      [
        "Upah Lembur (Overtime)",
        "Dihitung per jam saat karyawan ditugaskan melebihi shift normal 8 jam.",
        "Wajib disetujui oleh Manager Operasional."
      ],
      [
        "Insentif Target Omzet (Bonus)",
        "Bonus otomatis dihitung jika omzet bulanan kedai melampaui target.",
        "Mendorong motivasi seluruh tim barista, dapur, dan kasir."
      ],
      [
        "Cetak Slip Gaji PDF",
        "Manager/Finance klik 'Generate Slip Gaji' -> Langsung terbit PDF resmi siap kirim.",
        "Rincian bersih (Take Home Pay) transparan tanpa hitung manual."
      ]
    ],
    theme: "grid",
    headStyles: { fillColor: ACCENT_BLUE as any, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 6.8 },
    bodyStyles: { fontSize: 6.3, textColor: TEXT_DARK as any, cellPadding: 1.8 },
    columnStyles: {
      0: { cellWidth: 42, fontStyle: "bold" },
      1: { cellWidth: 80 },
      2: { cellWidth: 60, textColor: [4, 120, 87] },
    },
    margin: { left: margin, right: margin },
  });

  drawFooter(doc, 2, totalPages, "Panduan Manajerial Owner & Manager");

  // ─── HALAMAN 3: AUDIT LOG, KEAMANAN & PROTOKOL RESET RESMI ───
  doc.addPage();
  drawSubpageHeader(doc, "Audit Log & Protokol Reset Data Uji Coba", "Keamanan & Pengawasan");

  curY = 20;
  curY = drawSectionHeader(
    doc,
    curY,
    "5. Pengawasan Audit Trail & Investigasi Kecurangan",
    "Semua tindakan di aplikasi tercatat otomatis dan tidak dapat dimanipulasi."
  );

  autoTable(doc, {
    startY: curY,
    head: [["Jenis Catatan Audit", "Data yang Direkam", "Cara Memeriksa di Menu Audit Log"]],
    body: [
      [
        "Buka / Tutup Shift Kasir",
        "Jam presisi, modal awal, kas akhir aktual, selisih kas, foto verifikasi.",
        "Buka menu 'Audit Logs' -> Filter Kategori: 'CASH_SHIFT'."
      ],
      [
        "Void / Pembatalan Struk",
        "Nomor order, daftar menu yang dibatalkan, nominal rupiah, nama supervisor.",
        "Filter Kategori: 'ORDER_VOID' -> Cek alasan pembatalan."
      ],
      [
        "Penyesuaian Manual Stok",
        "Jumlah gramatur sebelum & sesudah, nilai kerugian HPP, nama pelaksana.",
        "Filter Kategori: 'INVENTORY_ADJUSTMENT'."
      ],
      [
        "Perubahan Harga Menu",
        "Harga lama vs harga baru, waktu pergantian harga.",
        "Filter Kategori: 'PRICE_UPDATE'."
      ]
    ],
    theme: "grid",
    headStyles: { fillColor: BRAND_NAVY as any, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 6.8 },
    bodyStyles: { fontSize: 6.3, textColor: TEXT_DARK as any, cellPadding: 1.8 },
    columnStyles: {
      0: { cellWidth: 44, fontStyle: "bold" },
      1: { cellWidth: 80 },
      2: { cellWidth: 58, textColor: [30, 58, 138] },
    },
    margin: { left: margin, right: margin },
  });

  curY = (doc as any).lastAutoTable.finalY + 6;

  curY = drawSectionHeader(
    doc,
    curY,
    "6. Standar Prosedur Reset Transaksi Sebelum Peluncuran (Go-Live)",
    "Langkah resmi menghapus data uji coba di awal bulan depan agar sistem bersih sempurna."
  );

  autoTable(doc, {
    startY: curY,
    head: [["Urutan Langkah", "Instruksi Eksekusi Super Admin", "Hasil Sistem"]],
    body: [
      [
        "Langkah 1",
        "Login menggunakan akun Super Admin ('admin') di aplikasi.",
        "Otentikasi token sesi tingkat tertinggi terverifikasi."
      ],
      [
        "Langkah 2",
        "Buka menu 'Pengaturan Sistem' -> Submenu 'Pemeliharaan Database'.",
        "Panel Reset Transaksi Uji Coba terbuka."
      ],
      [
        "Langkah 3",
        "Masukkan PIN Super Admin dan ketik konfirmasi teks: 'HAPUS DATA UJI COBA'.",
        "Sistem memverifikasi hash PIN dan mencocokkan frasa kunci."
      ],
      [
        "Langkah 4",
        "Klik tombol merah 'Mulai Bersihkan Riwayat Transaksi'.",
        "Semua pesanan dummy, kas uji coba, dan shift dibersihkan 100%."
      ]
    ],
    theme: "grid",
    headStyles: { fillColor: [185, 28, 28], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 6.8 },
    bodyStyles: { fontSize: 6.3, textColor: TEXT_DARK as any, cellPadding: 1.8 },
    columnStyles: {
      0: { cellWidth: 26, fontStyle: "bold" },
      1: { cellWidth: 96 },
      2: { cellWidth: 60, textColor: [4, 120, 87] },
    },
    margin: { left: margin, right: margin },
  });

  drawFooter(doc, 3, totalPages, "Panduan Manajerial Owner & Manager");

  const outPath = path.join(process.cwd(), "public", "Panduan_Manajerial_Owner_dan_Manager.pdf");
  fs.writeFileSync(outPath, Buffer.from(doc.output("arraybuffer")));
  console.log(`[Manager Guide] Created: ${outPath}`);
};

// ============================================================================
// MAIN EXECUTION
// ============================================================================
console.log("Generating Official Julia's Coffee PDFs...");
generateMasterGuide();
generateKasirKdsGuide();
generateManagerOwnerGuide();
console.log("All 3 guide documents successfully created!");
