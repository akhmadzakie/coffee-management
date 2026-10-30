import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  SalesTransaction,
  Ingredient,
  StockMovement,
  CashTransaction,
  Settings,
  PayrollRecord,
  DailyAttendance,
  KPIRecord,
  Employee,
} from "../types";
import { formatCurrency } from "./format";

export const formatDateIndo = (dateStr: string | Date): string => {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString("id-ID", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

/**
 * Bulletproof helper to instantiate jsPDF across ESM / CJS / Vite environments.
 */
export const createJsPdfDoc = (
  orientation?: "p" | "portrait" | "l" | "landscape",
  unit?: "pt" | "px" | "in" | "mm" | "cm" | "ex" | "em" | "pc",
  format?: string | [number, number]
): jsPDF => {
  const Constructor: any =
    typeof jsPDF === "function"
      ? jsPDF
      : (jsPDF as any)?.default || (jsPDF as any)?.jsPDF || jsPDF;
  return new Constructor(orientation, unit, format);
};

export const exportToCSV = (filename: string, rows: any[]) => {
  if (!rows || !rows.length) return;
  const separator = ",";
  const keys = Object.keys(rows[0]);
  const csvContent =
    keys.join(separator) +
    "\n" +
    rows
      .map((row) => {
        return keys
          .map((k) => {
            let cell = row[k] === null || row[k] === undefined ? "" : row[k];
            cell =
              cell instanceof Date
                ? cell.toLocaleString("id-ID")
                : cell.toString().replace(/"/g, '""');
            if (cell.search(/("|,|\n)/g) >= 0) cell = `"${cell}"`;
            return cell;
          })
          .join(separator);
      })
      .join("\n");
  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const link = document.createElement("a");
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};

export const downloadCsvTemplate = (filename: string, headers: string[], exampleRow?: string[]) => {
  const separator = ",";
  let csvContent = headers.map(h => `"${h}"`).join(separator);
  
  if (exampleRow && exampleRow.length > 0) {
    csvContent += "\n" + exampleRow.map(cell => `"${cell}"`).join(separator);
  }

  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const link = document.createElement("a");
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};

export const filterByDateRange = <
  T extends { date?: string; importDate?: string; timestamp?: string },
>(
  items: T[],
  startDate?: string,
  endDate?: string,
): T[] => {
  if (!startDate && !endDate) return items;
  return items.filter((item) => {
    const dStr = item.date || item.importDate || item.timestamp;
    if (!dStr) return true;
    const itemTime = new Date(dStr).getTime();
    if (isNaN(itemTime)) return true;
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      if (itemTime < start.getTime()) return false;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (itemTime > end.getTime()) return false;
    }
    return true;
  });
};

const setupPdfHeader = (
  doc: jsPDF,
  settings: Settings,
  title: string,
  periodLabel: string,
) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const bannerHeight = 48;

  // Brand Header Background
  doc.setFillColor(30, 58, 138); // blue-900 (navy executive header)
  doc.rect(0, 0, pageWidth, bannerHeight, "F");

  // Accent Line at bottom of banner
  doc.setFillColor(59, 130, 246); // blue-500
  doc.rect(0, bannerHeight - 1.5, pageWidth, 1.5, "F");

  // --- BARIS 1: BRAND NAME (Kiri) & TANGGAL CETAK (Kanan) ---
  const brandName = (
    settings.brandName ||
    (settings as any).storeName ||
    "JULIA'S MANAGEMENT SYSTEM"
  ).toUpperCase();
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text(brandName, 14, 14);

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text(`Dicetak: ${formatDateIndo(new Date())}`, pageWidth - 14, 14, {
    align: "right",
  });

  // --- BARIS 2: ALAMAT KEDAI (Kiri) & PERIODE LAPORAN (Kanan) ---
  if (settings.companyAddress) {
    const addr =
      settings.companyAddress.length > 70
        ? settings.companyAddress.substring(0, 67) + "..."
        : settings.companyAddress;
    doc.text(addr, 14, 20);
  } else {
    doc.text("Sistem Manajemen & Pembukuan Bisnis", 14, 20);
  }

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(226, 232, 240); // slate-200
  doc.text(`Periode: ${periodLabel}`, pageWidth - 14, 20, { align: "right" });

  // --- GARIS PEMISAH HALUS DI DALAM BANNER ---
  doc.setDrawColor(59, 130, 246); // blue-500
  doc.setLineWidth(0.3);
  doc.line(14, 24, pageWidth - 14, 24);

  // --- BARIS 3: JUDUL LAPORAN MANDIRI (ANTI-TABRAKAN / BARIS TERPISAH) ---
  doc.setTextColor(255, 255, 255);
  const titleText = title.toUpperCase();
  const titleFontSize =
    titleText.length > 42 ? 11.5 : titleText.length > 32 ? 13 : 14.5;
  doc.setFontSize(titleFontSize);
  doc.setFont("helvetica", "bold");
  doc.text(titleText, 14, 34);

  // Subtitle dokumen resmi
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(191, 219, 254); // blue-200
  doc.text("DOKUMEN RESMI SISTEM MANAJEMEN OPERASIONAL & KEUANGAN", 14, 40);

  // Badge rahasia/eksekutif di kanan bawah banner
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(191, 219, 254);
  doc.text("CONFIDENTIAL & PROPRIETARY", pageWidth - 14, 40, { align: "right" });

  // Reset text color for body
  doc.setTextColor(15, 23, 42); // slate-900
};

export const exportSalesToPDF = ({
  sales,
  settings,
  periodLabel,
}: {
  sales: SalesTransaction[];
  settings: Settings;
  periodLabel: string;
}) => {
  const doc = createJsPdfDoc();
  setupPdfHeader(doc, settings, "Laporan Penjualan", periodLabel);

  const tableData =
    sales.length > 0
      ? sales.map((s) => [
          formatDateIndo(s.date),
          s.menuName,
          s.quantitySold.toString(),
          formatCurrency(s.totalPrice),
        ])
      : [["-", "Tidak ada data transaksi di periode ini", "-", "-"]];

  autoTable(doc, {
    startY: 56,
    head: [["Tanggal", "Nama Menu", "Quantity", "Total (Rp)"]],
    body: tableData,
    foot:
      sales.length > 0
        ? [
            [
              "",
              "TOTAL",
              sales.reduce((a, b) => a + b.quantitySold, 0).toString(),
              formatCurrency(sales.reduce((a, b) => a + b.totalPrice, 0)),
            ],
          ]
        : [],
    theme: "grid",
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: "bold",
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    footStyles: {
      fillColor: [248, 250, 252],
      textColor: [15, 23, 42],
      fontStyle: "bold",
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    bodyStyles: {
      textColor: [71, 85, 105],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    alternateRowStyles: { fillColor: [250, 252, 253] },
    columnStyles: {
      2: { halign: "center" },
      3: { halign: "right" },
    },
  });
  doc.save(`Laporan_Penjualan_${periodLabel}.pdf`);
};

export const exportInventoryToPDF = ({
  ingredients,
  movements,
  settings,
  periodLabel,
}: {
  ingredients: Ingredient[];
  movements: StockMovement[];
  settings: Settings;
  periodLabel: string;
}) => {
  const doc = createJsPdfDoc();
  setupPdfHeader(doc, settings, "Laporan Mutasi Stok", periodLabel);

  const tableData =
    movements.length > 0
      ? movements.map((m) => {
          const ing = ingredients.find((i) => i.id === m.ingredientId);
          return [
            formatDateIndo(m.date),
            ing?.name || "-",
            m.type === "IN" ? "Masuk" : "Keluar",
            `${m.quantity} ${ing?.unit || ""}`,
            m.createdBy,
          ];
        })
      : [["-", "Tidak ada mutasi stok di periode ini", "-", "-", "-"]];

  autoTable(doc, {
    startY: 56,
    head: [["Tanggal", "Bahan Baku", "Jenis", "Jumlah", "Operator"]],
    body: tableData,
    theme: "grid",
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: "bold",
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    bodyStyles: {
      textColor: [71, 85, 105],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    alternateRowStyles: { fillColor: [250, 252, 253] },
    columnStyles: {
      2: { halign: "center" },
      3: { halign: "right" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 2) {
        if (data.cell.raw === "Masuk") {
          data.cell.styles.textColor = [5, 150, 105]; // emerald-600
          data.cell.styles.fontStyle = "bold";
        } else if (data.cell.raw === "Keluar") {
          data.cell.styles.textColor = [225, 29, 72]; // rose-600
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
  });
  doc.save(`Laporan_Stok_${periodLabel}.pdf`);
};

export const exportFinanceToPDF = ({
  finance,
  settings,
  periodLabel,
}: {
  finance: CashTransaction[];
  settings: Settings;
  periodLabel: string;
}) => {
  const doc = createJsPdfDoc();
  setupPdfHeader(doc, settings, "Laporan Arus Kas", periodLabel);

  const tableData =
    finance.length > 0
      ? finance.map((f) => [
          formatDateIndo(f.date),
          f.type === "CASH_IN" ? "Pemasukan" : "Pengeluaran",
          f.category,
          f.description,
          (f.type === "CASH_IN" ? "+" : "-") + formatCurrency(f.amount),
        ])
      : [["-", "-", "Tidak ada data arus kas di periode ini", "-", "-"]];

  const totalIn = finance
    .filter((f) => f.type === "CASH_IN")
    .reduce((a, b) => a + b.amount, 0);
  const totalOut = finance
    .filter((f) => f.type === "CASH_OUT")
    .reduce((a, b) => a + b.amount, 0);
  const netCash = totalIn - totalOut;

  autoTable(doc, {
    startY: 56,
    head: [["Tanggal", "Jenis", "Kategori", "Keterangan", "Jumlah (Rp)"]],
    body: tableData,
    theme: "grid",
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: "bold",
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    bodyStyles: {
      textColor: [71, 85, 105],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    alternateRowStyles: { fillColor: [250, 252, 253] },
    columnStyles: {
      4: { halign: "right", fontStyle: "bold" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 4) {
        if (data.row.raw[1] === "Pemasukan") {
          data.cell.styles.textColor = [5, 150, 105];
        } else if (data.row.raw[1] === "Pengeluaran") {
          data.cell.styles.textColor = [225, 29, 72];
        }
      }
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY || 50;

  // Summary Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, finalY + 10, 182, 35, 3, 3, "FD");

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("RINGKASAN KEUANGAN", 20, finalY + 18);

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Total Pemasukan:", 20, finalY + 26);
  doc.setTextColor(5, 150, 105);
  doc.text(formatCurrency(totalIn), 70, finalY + 26, { align: "right" });

  doc.setTextColor(71, 85, 105);
  doc.text("Total Pengeluaran:", 100, finalY + 26);
  doc.setTextColor(225, 29, 72);
  doc.text(formatCurrency(totalOut), 155, finalY + 26, { align: "right" });

  doc.setDrawColor(226, 232, 240);
  doc.line(20, finalY + 31, 190, finalY + 31);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("Arus Kas Bersih:", 20, finalY + 38);

  doc.setFontSize(14);
  doc.setTextColor(
    netCash >= 0 ? 5 : 225,
    netCash >= 0 ? 150 : 29,
    netCash >= 0 ? 105 : 72,
  );
  doc.text(formatCurrency(netCash), 190, finalY + 38, { align: "right" });

  doc.save(`Laporan_Keuangan_${periodLabel}.pdf`);
};

export const exportSalesToCSV = ({
  sales,
  settings,
}: {
  sales: SalesTransaction[];
  settings: Settings;
}) => {
  const rows = sales.map((s) => ({
    Tanggal: formatDateIndo(s.date),
    "Nama Menu": s.menuName,
    Quantity: s.quantitySold,
    "Total Penjualan": s.totalPrice,
  }));
  exportToCSV(`Penjualan_${formatDateIndo(new Date())}`, rows);
};

export const exportInventoryToCSV = ({
  ingredients,
  movements,
  settings,
}: {
  ingredients: Ingredient[];
  movements: StockMovement[];
  settings: Settings;
}) => {
  const rows = movements.map((m) => {
    const ing = ingredients.find((i) => i.id === m.ingredientId);
    return {
      Tanggal: formatDateIndo(m.date),
      "Bahan Baku": ing?.name || "-",
      Kategori: ing?.category || "-",
      "Jenis Mutasi": m.type === "IN" ? "Masuk" : "Keluar",
      Jumlah: m.quantity,
      Satuan: ing?.unit || "-",
      Catatan: m.note || "-",
      Operator: m.createdBy,
    };
  });
  exportToCSV(`Mutasi_Stok_${formatDateIndo(new Date())}`, rows);
};

export const exportFinanceToCSV = ({
  finance,
  settings,
}: {
  finance: CashTransaction[];
  settings: Settings;
}) => {
  const rows = finance.map((f) => ({
    Tanggal: formatDateIndo(f.date),
    "Jenis Transaksi": f.type === "CASH_IN" ? "Pemasukan" : "Pengeluaran",
    Kategori: f.category,
    Keterangan: f.description,
    "Jumlah (Rp)": f.amount,
  }));
  exportToCSV(`Arus_Kas_${formatDateIndo(new Date())}`, rows);
};

export const exportPayrollToPDF = ({
  payroll,
  employees,
  settings,
  periodLabel,
}: {
  payroll: PayrollRecord[];
  employees: Employee[];
  settings: Settings;
  periodLabel: string;
}) => {
  const doc = createJsPdfDoc("l", "mm", "a4");
  setupPdfHeader(doc, settings, "Laporan Rekapitulasi Penggajian & Bonus", periodLabel);

  const tableData =
    payroll.length > 0
      ? payroll.map((p, idx) => {
          const emp = employees.find((e) => e.id === p.employeeId);
          return [
            String(idx + 1),
            emp?.name || p.employeeId,
            emp?.position || "-",
            emp?.department || "-",
            formatCurrency(p.basicSalary),
            formatCurrency(p.positionAllowance),
            formatCurrency((p.mealAllowance || 0) + (p.transportAllowance || 0)),
            formatCurrency(p.kpiBonus + (p.targetBonus || 0)),
            formatCurrency(p.alphaDeduction),
            formatCurrency(p.netPay),
            p.status,
          ];
        })
      : [["-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "Tidak ada data penggajian"]];

  const totalBasic = payroll.reduce((s, p) => s + p.basicSalary, 0);
  const totalKpiBonus = payroll.reduce((s, p) => s + p.kpiBonus + (p.targetBonus || 0), 0);
  const totalDeductions = payroll.reduce((s, p) => s + p.alphaDeduction + (p.otherDeductions || 0), 0);
  const totalNet = payroll.reduce((s, p) => s + p.netPay, 0);

  autoTable(doc, {
    startY: 56,
    head: [
      [
        "No",
        "Nama Karyawan",
        "Jabatan",
        "Divisi",
        "Gaji Pokok",
        "Tunj. Jabatan",
        "Makan & Trp",
        "Bonus KPI",
        "Potongan",
        "Total THP",
        "Status",
      ],
    ],
    body: tableData,
    theme: "grid",
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [51, 65, 85],
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { halign: "center", cellWidth: 10 },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right", fontStyle: "bold", textColor: [5, 150, 105] },
      8: { halign: "right", textColor: [225, 29, 72] },
      9: { halign: "right", fontStyle: "bold", textColor: [30, 58, 138] },
      10: { halign: "center" },
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 50;
  if (finalY < 165) {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, finalY + 8, 269, 22, 3, 3, "FD");

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 58, 138);
    doc.text("TOTAL BEBAN PENGGAJIAN & BONUS OUTLET:", 20, finalY + 16);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text(`Gaji Pokok: ${formatCurrency(totalBasic)}`, 20, finalY + 23);
    doc.text(`Bonus KPI: ${formatCurrency(totalKpiBonus)}`, 95, finalY + 23);
    doc.text(`Potongan: -${formatCurrency(totalDeductions)}`, 165, finalY + 23);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(5, 150, 105);
    doc.text(`Take Home Pay (THP): ${formatCurrency(totalNet)}`, 225, finalY + 23);
  }

  doc.save(`Laporan_Penggajian_${periodLabel.replace(/\s+/g, "_")}.pdf`);
};

export const exportPayrollToCSV = ({
  payroll,
  employees,
}: {
  payroll: PayrollRecord[];
  employees: Employee[];
}) => {
  const rows = payroll.map((p, idx) => {
    const emp = employees.find((e) => e.id === p.employeeId);
    return {
      No: idx + 1,
      "Nama Karyawan": emp?.name || p.employeeId,
      Jabatan: emp?.position || "-",
      Divisi: emp?.department || "-",
      Periode: p.period,
      "Gaji Pokok": p.basicSalary,
      "Tunjangan Jabatan": p.positionAllowance,
      "Uang Makan": p.mealAllowance,
      "Uang Transport": p.transportAllowance || 0,
      "Bonus KPI": p.kpiBonus,
      "Bonus Target Omzet": p.targetBonus || 0,
      "Lembur / Insentif": p.overtimePay || 0,
      "Potongan Alpha": p.alphaDeduction,
      "Potongan Lain": p.otherDeductions || 0,
      "Take Home Pay (THP)": p.netPay,
      Status: p.status,
      "Tanggal Dibayar": p.paidDate || "-",
    };
  });
  exportToCSV(`Rekap_Payroll_${formatDateIndo(new Date())}`, rows);
};

export const exportAttendanceToPDF = ({
  attendances,
  employees,
  settings,
  periodLabel,
}: {
  attendances: DailyAttendance[];
  employees: Employee[];
  settings: Settings;
  periodLabel: string;
}) => {
  const doc = createJsPdfDoc();
  setupPdfHeader(doc, settings, "Laporan Rekapitulasi Absensi & Jam Kerja", periodLabel);

  const empMap = new Map<string, { present: number; late: number; sick: number; alpha: number; totalHours: number }>();
  attendances.forEach((att) => {
    const prev = empMap.get(att.employeeId) || { present: 0, late: 0, sick: 0, alpha: 0, totalHours: 0 };
    if (att.status === "HADIR") prev.present++;
    else if (att.status === "TERLAMBAT") {
      prev.present++;
      prev.late++;
    } else if (["IZIN", "SAKIT"].includes(att.status)) prev.sick++;
    else if (["ALPHA", "DITOLAK"].includes(att.status)) prev.alpha++;

    if (att.clockInTime && att.clockOutTime) {
      const dur = (new Date(att.clockOutTime).getTime() - new Date(att.clockInTime).getTime()) / 3600000;
      if (dur > 0 && dur < 24) prev.totalHours += dur;
    }
    empMap.set(att.employeeId, prev);
  });

  const tableData = Array.from(empMap.entries()).map(([empId, stats], idx) => {
    const emp = employees.find((e) => e.id === empId);
    const totalDays = stats.present + stats.sick + stats.alpha;
    const rate = totalDays > 0 ? Math.round((stats.present / totalDays) * 100) : 0;
    return [
      String(idx + 1),
      emp?.name || empId,
      emp?.position || "-",
      `${stats.present} Hari`,
      `${stats.late}x`,
      `${stats.sick} Hari`,
      `${stats.alpha} Hari`,
      `${stats.totalHours.toFixed(1)} Jam`,
      `${rate}%`,
    ];
  });

  autoTable(doc, {
    startY: 56,
    head: [["No", "Nama Karyawan", "Jabatan", "Hadir", "Terlambat", "Izin/Sakit", "Alpha", "Total Jam", "% Hadir"]],
    body: tableData.length > 0 ? tableData : [["-", "-", "-", "-", "-", "-", "-", "-", "Tidak ada log absensi"]],
    theme: "grid",
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    bodyStyles: { textColor: [51, 65, 85] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { halign: "center" },
      3: { halign: "center", fontStyle: "bold", textColor: [5, 150, 105] },
      4: { halign: "center", textColor: [217, 119, 6] },
      5: { halign: "center" },
      6: { halign: "center", textColor: [225, 29, 72] },
      7: { halign: "right" },
      8: { halign: "center", fontStyle: "bold" },
    },
  });

  doc.save(`Laporan_Absensi_${periodLabel.replace(/\s+/g, "_")}.pdf`);
};

export const exportAttendanceToCSV = ({
  attendances,
  employees,
}: {
  attendances: DailyAttendance[];
  employees: Employee[];
}) => {
  const rows = attendances.map((a, idx) => {
    const emp = employees.find((e) => e.id === a.employeeId);
    return {
      No: idx + 1,
      Tanggal: a.date,
      "Nama Karyawan": emp?.name || a.employeeId,
      Jabatan: emp?.position || "-",
      Divisi: emp?.department || "-",
      Status: a.status,
      "Jam Masuk": a.clockInTime ? new Date(a.clockInTime).toLocaleTimeString("id-ID") : "-",
      "Jam Pulang": a.clockOutTime ? new Date(a.clockOutTime).toLocaleTimeString("id-ID") : "-",
      "Status Verifikasi": a.approvalStatus,
    };
  });
  exportToCSV(`Rekap_Absensi_${formatDateIndo(new Date())}`, rows);
};

export const exportKpiToPDF = ({
  kpiRecords,
  employees,
  settings,
  periodLabel,
}: {
  kpiRecords: KPIRecord[];
  employees: Employee[];
  settings: Settings;
  periodLabel: string;
}) => {
  const doc = createJsPdfDoc();
  setupPdfHeader(doc, settings, "Laporan Capaian KPI & Kinerja Karyawan", periodLabel);

  const tableData =
    kpiRecords.length > 0
      ? kpiRecords.map((k, idx) => {
          const emp = employees.find((e) => e.id === k.employeeId);
          const grade =
            k.totalScore >= 85 ? "Sangat Baik (A)" : k.totalScore >= 70 ? "Baik (B)" : k.totalScore >= 55 ? "Cukup (C)" : "Perlu Evaluasi (D)";
          return [
            String(idx + 1),
            emp?.name || k.employeeId,
            emp?.position || "-",
            (k as any).period || `Bulan ${k.month}/${k.year}`,
            `${k.totalScore.toFixed(1)} / 100`,
            grade,
            formatCurrency(k.kpiBonus),
            k.notes || "-",
          ];
        })
      : [["-", "-", "-", "-", "-", "-", "-", "Belum ada evaluasi KPI tercatat"]];

  autoTable(doc, {
    startY: 56,
    head: [["No", "Nama Karyawan", "Jabatan", "Periode", "Skor KPI", "Grade", "Bonus KPI", "Catatan Evaluasi"]],
    body: tableData,
    theme: "grid",
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    bodyStyles: { textColor: [51, 65, 85] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { halign: "center" },
      4: { halign: "center", fontStyle: "bold", textColor: [30, 58, 138] },
      5: { halign: "center", fontStyle: "bold" },
      6: { halign: "right", fontStyle: "bold", textColor: [5, 150, 105] },
    },
  });

  doc.save(`Laporan_KPI_${periodLabel.replace(/\s+/g, "_")}.pdf`);
};

export const exportKpiToCSV = ({
  kpiRecords,
  employees,
}: {
  kpiRecords: KPIRecord[];
  employees: Employee[];
}) => {
  const rows = kpiRecords.map((k, idx) => {
    const emp = employees.find((e) => e.id === k.employeeId);
    return {
      No: idx + 1,
      "Nama Karyawan": emp?.name || k.employeeId,
      Jabatan: emp?.position || "-",
      Divisi: emp?.department || "-",
      Periode: (k as any).period || `${k.year}-${String(k.month).padStart(2, "0")}`,
      "Total Skor (0-100)": k.totalScore,
      "Bonus KPI (Rp)": k.kpiBonus,
      "Catatan Evaluator": k.notes || "-",
    };
  });
  exportToCSV(`Rekap_KPI_${formatDateIndo(new Date())}`, rows);
};

export const exportMasterExecutiveReportPDF = ({
  sales,
  finance,
  ingredients,
  payroll,
  attendances,
  kpiRecords,
  employees,
  settings,
  periodLabel,
}: {
  sales: SalesTransaction[];
  finance: CashTransaction[];
  ingredients: Ingredient[];
  payroll: PayrollRecord[];
  attendances: DailyAttendance[];
  kpiRecords: KPIRecord[];
  employees: Employee[];
  settings: Settings;
  periodLabel: string;
}) => {
  const doc = createJsPdfDoc();
  setupPdfHeader(doc, settings, "Laporan Eksekutif Master (Executive Summary)", periodLabel);

  const totalGrossSales = sales.reduce((sum, s) => sum + ((s as any).subtotal || (s as any).total || s.totalPrice || 0), 0);
  const totalDiscount = sales.reduce((sum, s) => sum + ((s as any).discount || 0), 0);
  const totalNetSales = sales.reduce((sum, s) => sum + ((s as any).total || s.totalPrice || 0), 0);
  const totalSalesTransactions = sales.length;
  const aov = totalSalesTransactions > 0 ? Math.round(totalNetSales / totalSalesTransactions) : 0;

  const totalCashIn = finance
    .filter((f) => (f.type as string) === "IN" || (f as any).type === "INCOME" || f.type === "CASH_IN")
    .reduce((sum, f) => sum + (f.amount || 0), 0);
  const totalCashOut = finance
    .filter((f) => (f.type as string) === "OUT" || (f as any).type === "EXPENSE" || f.type === "CASH_OUT")
    .reduce((sum, f) => sum + (f.amount || 0), 0);

  const totalPayrollCost = payroll.reduce((sum, p) => sum + (p.netPay || p.grossPay || 0), 0);
  const estimatedOperatingProfit = totalNetSales - totalCashOut - totalPayrollCost;

  const totalInventoryAssetValue = ingredients.reduce((sum, ing) => {
    const cost = ing.costPerUnit || (ing as any).unitPrice || (ing as any).price || 0;
    const stockQty = ing.currentStock ?? (ing as any).stock ?? 0;
    return sum + (cost * stockQty);
  }, 0);
  const lowStockCount = ingredients.filter((ing) => (ing.currentStock ?? (ing as any).stock ?? 0) <= (ing.minStock || 0)).length;

  const totalPresentLogs = attendances.filter((a) => ["HADIR", "TERLAMBAT"].includes(a.status)).length;
  const attendanceRate = attendances.length > 0 ? Math.round((totalPresentLogs / attendances.length) * 100) : 100;

  // 1. Table KPI Finansial
  autoTable(doc, {
    startY: 56,
    head: [["No", "Indikator Kinerja Keuangan", "Nilai / Jumlah", "Catatan"]],
    body: [
      ["1", "Total Omzet Penjualan Kotor (Gross Sales)", formatCurrency(totalGrossSales), "Subtotal sebelum diskon promo"],
      ["2", "Total Diskon & Promo", `-${formatCurrency(totalDiscount)}`, "Total potongan harga belanja"],
      ["3", "Total Penjualan Bersih (Net Sales)", formatCurrency(totalNetSales), `${totalSalesTransactions} Struk (AOV: ${formatCurrency(aov)})`],
      ["4", "Total Kas Masuk Non-Kasir (In)", formatCurrency(totalCashIn), "Penerimaan kas/transfer di luar kasir"],
      ["5", "Total Pengeluaran Kas Operasional (Out)", `-${formatCurrency(totalCashOut)}`, "Beban operasional, belanja, & utilitas"],
      ["6", "Total Pengeluaran Gaji Karyawan (Payroll)", `-${formatCurrency(totalPayrollCost)}`, `${payroll.length} Slip gaji karyawan aktif`],
      ["7", "Estimasi Laba Bersih Operasional", formatCurrency(estimatedOperatingProfit), estimatedOperatingProfit >= 0 ? "Surplus / Laba Operasional Positif" : "Defisit Operasional"],
    ],
    theme: "grid",
    headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: {
      0: { halign: "center", cellWidth: 12 },
      1: { fontStyle: "bold", cellWidth: 70 },
      2: { halign: "right", fontStyle: "bold" },
      3: { textColor: [100, 116, 139] },
    },
  });

  // 2. Table KPI Operasional & SDM
  const lastY = (doc as any).lastAutoTable?.finalY || 130;

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("Ringkasan Operasional, Stok, & Kedisiplinan SDM", 14, lastY + 12);

  autoTable(doc, {
    startY: lastY + 16,
    head: [["No", "Aspek Operasional & SDM", "Statistik", "Status & Keterangan"]],
    body: [
      ["1", "Nilai Aset Bahan Baku (Stok Tersedia)", formatCurrency(totalInventoryAssetValue), `${ingredients.length} Varian bahan baku tercatat`],
      ["2", "Peringatan Stok Menipis", `${lowStockCount} Bahan`, lowStockCount > 0 ? "Perlu segera restock bahan baku" : "Stok bahan baku seluruhnya aman"],
      ["3", "Total Shift Kehadiran Terekam", `${attendances.length} Shift`, `Tingkat Disiplin Hadir: ${attendanceRate}%`],
      ["4", "Total Presensi Hadir / Terlambat", `${totalPresentLogs} Kali`, "Catatan presensi foto GPS terverifikasi"],
      ["5", "Evaluasi Kinerja KPI Karyawan", `${kpiRecords.length} Catatan`, `Total Bonus KPI: ${formatCurrency(kpiRecords.reduce((s, k) => s + (k.kpiBonus || 0), 0))}`],
    ],
    theme: "grid",
    headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: {
      0: { halign: "center", cellWidth: 12 },
      1: { fontStyle: "bold", cellWidth: 70 },
      2: { halign: "right", fontStyle: "bold" },
      3: { textColor: [100, 116, 139] },
    },
  });

  const storeSlug = (settings.brandName || (settings as any).storeName || "Julia_Coffee").replace(/\s+/g, "_");
  const periodSlug = periodLabel.replace(/\s+/g, "_");
  doc.save(`Laporan_Eksekutif_${storeSlug}_${periodSlug}.pdf`);
};

export interface ExportSinglePayslipParams {
  payroll: PayrollRecord;
  employee: Employee;
  settings: Settings;
  attendanceBreakdown?: {
    totalWorkingDays: number;
    presentDays: number;
    lateDays: number;
    sickOrLeaveDays: number;
    alphaDays: number;
  };
  kpiDetails?: {
    label: string;
    ratio: number;
    checklistDays: number;
    expectedDays: number;
    isLeader?: boolean;
  };
  paidViaAccountName?: string | null;
}

export const exportSinglePayslipPDF = ({
  payroll,
  employee,
  settings,
  attendanceBreakdown,
  kpiDetails,
  paidViaAccountName,
}: ExportSinglePayslipParams) => {
  const doc = createJsPdfDoc("p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // 1. Header Banner (Dark Navy / Executive)
  const headerHeight = 36;
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, headerHeight, "F");

  // Accent Gold Line
  doc.setFillColor(245, 158, 11); // amber-500
  doc.rect(0, headerHeight - 1.5, pageWidth, 1.5, "F");

  // Store Brand Name & Info (Left)
  const brandName = (settings.brandName || (settings as any).storeName || "JULIA'S COFFEE & EATERY").toUpperCase();
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(brandName, margin, 13);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(203, 213, 225); // slate-300
  const address = (settings as any).storeAddress || settings.companyAddress || "Outlet Utama & Operasional Kedai";
  doc.text(address.length > 60 ? address.substring(0, 58) + "..." : address, margin, 19);

  const phone = (settings as any).storePhone || (settings as any).phone || "Sistem Manajemen & Penggajian Terpadu";
  doc.text(phone.startsWith("Sistem") ? phone : `Telp: ${phone}`, margin, 24);

  // Document Title & Period Badge (Right)
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(251, 191, 36); // amber-400
  doc.text("SLIP GAJI RESMI KARYAWAN", pageWidth - margin, 13, { align: "right" });

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(255, 255, 255);

  let periodStr = payroll.period;
  try {
    const [y, m] = payroll.period.split("-");
    const d = new Date(parseInt(y), parseInt(m) - 1, 1);
    periodStr = d.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  } catch {
    periodStr = payroll.period;
  }
  doc.text(`Periode: ${periodStr}`, pageWidth - margin, 19, { align: "right" });

  // Status Badge
  const statusLabel = payroll.status === "PAID"
    ? "STATUS: LUNAS / SUDAH DITRANSFER"
    : payroll.status === "APPROVED"
    ? "STATUS: DISETUJUI MANAJER"
    : "STATUS: DRAFT BELUM DISETUJUI";

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  if (payroll.status === "PAID") {
    doc.setTextColor(52, 211, 153); // emerald-400
  } else if (payroll.status === "APPROVED") {
    doc.setTextColor(96, 165, 250); // blue-400
  } else {
    doc.setTextColor(251, 191, 36); // amber-400
  }
  doc.text(statusLabel, pageWidth - margin, 25, { align: "right" });

  let curY = headerHeight + 6;

  // 2. Employee Identity Box
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(margin, curY, contentWidth, 20, 2, 2, "FD");

  const colW = contentWidth / 4;

  // Col 1: Nama
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text("NAMA KARYAWAN", margin + 4, curY + 6);
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(employee.name || "-", margin + 4, curY + 13);

  // Col 2: NIK / ID
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("NIK / USERNAME", margin + colW + 4, curY + 6);
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(employee.username || employee.id.slice(0, 8), margin + colW + 4, curY + 13);

  // Col 3: Jabatan
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("JABATAN", margin + colW * 2 + 4, curY + 6);
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(employee.position || "Staff", margin + colW * 2 + 4, curY + 13);

  // Col 4: Departemen
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("DIVISI / DEPARTEMEN", margin + colW * 3 + 4, curY + 6);
  doc.setFontSize(9);
  doc.setTextColor(79, 70, 229); // indigo-600
  doc.text(employee.department || "Operasional", margin + colW * 3 + 4, curY + 13);

  curY += 24;

  // 3. Operational & KPI Cards
  if (attendanceBreakdown || kpiDetails) {
    const cardW = (contentWidth - 4) / 2;

    // Left: Attendance summary card
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(224, 231, 255); // indigo-100
    doc.roundedRect(margin, curY, cardW, 18, 2, 2, "FD");

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(67, 56, 202); // indigo-700
    doc.text("REKAPITULASI PRESENSI & KEHADIRAN", margin + 4, curY + 5.5);

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 65, 85);
    const attText = attendanceBreakdown
      ? `Hadir: ${attendanceBreakdown.presentDays} hari  •  Telat: ${attendanceBreakdown.lateDays}x  •  Izin: ${attendanceBreakdown.sickOrLeaveDays}  •  Alpha: ${attendanceBreakdown.alphaDays}`
      : "Data presensi terintegrasi jadwal";
    doc.text(attText, margin + 4, curY + 12);

    // Right: KPI Card
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(209, 250, 229); // emerald-100
    doc.roundedRect(margin + cardW + 4, curY, cardW, 18, 2, 2, "FD");

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(4, 120, 87); // emerald-700
    doc.text("CAPAIAN JOBDESK & KPI", margin + cardW + 8, curY + 5.5);

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 65, 85);
    const kpiText = kpiDetails
      ? `Capaian: ${kpiDetails.ratio}% (${kpiDetails.checklistDays}/${kpiDetails.expectedDays})  •  Bonus: +${formatCurrency(payroll.kpiBonus)}`
      : `Bonus KPI: +${formatCurrency(payroll.kpiBonus)}`;
    doc.text(kpiText, margin + cardW + 8, curY + 12);

    curY += 22;
  }

  // 4. Financial Breakdown Table
  const incomeItems: [string, string, string][] = [
    ["Gaji Pokok", "Upah pokok dasar kehadiran kerja", formatCurrency(payroll.basicSalary)],
  ];
  if (payroll.positionAllowance > 0) {
    const tierNote = payroll.matchedLeaderTier
      ? `Tunjangan Jabatan (${payroll.matchedLeaderTier.grade} - ${payroll.matchedLeaderTier.payoutPercentage}%)`
      : "Tunjangan tanggung jawab posisi";
    incomeItems.push(["Tunjangan Jabatan", tierNote, formatCurrency(payroll.positionAllowance)]);
  }
  if (payroll.mealAllowance > 0) {
    incomeItems.push(["Uang Makan", `Tunjangan makan operasional shift (${attendanceBreakdown?.presentDays || 0} hari)`, formatCurrency(payroll.mealAllowance)]);
  }
  if (payroll.transportAllowance > 0) {
    incomeItems.push(["Uang Transport", "Dukungan operasional transportasi", formatCurrency(payroll.transportAllowance)]);
  }
  if (payroll.kpiBonus > 0) {
    incomeItems.push(["Bonus KPI & Kinerja", kpiDetails?.label || "Insentif capaian checklist dan jobdesk", `+${formatCurrency(payroll.kpiBonus)}`]);
  }
  if ((payroll.targetBonus || 0) > 0) {
    incomeItems.push(["Bonus Omzet Toko", "Insentif target omzet kedai tercapai", `+${formatCurrency(payroll.targetBonus || 0)}`]);
  }
  if ((payroll.overtimePay || 0) > 0) {
    const otNote = payroll.overtimeHours ? `${payroll.overtimeHours} jam lembur disetujui` : "Uang lembur disahkan";
    incomeItems.push(["Upah Lembur", otNote, `+${formatCurrency(payroll.overtimePay)}`]);
  }

  const deductionItems: [string, string, string][] = [];
  if (payroll.alphaDeduction > 0) {
    deductionItems.push(["Potongan Ketidakhadiran (Alpha)", `${attendanceBreakdown?.alphaDays || 1} hari tidak hadir tanpa keterangan`, `-${formatCurrency(payroll.alphaDeduction)}`]);
  }
  if ((payroll.lateDeduction || 0) > 0) {
    const lateNote = payroll.lateHours ? `${payroll.lateHours} jam terlambat (${payroll.lateDays || 0}x)` : "Penalti keterlambatan shift";
    deductionItems.push(["Potongan Keterlambatan", lateNote, `-${formatCurrency(payroll.lateDeduction || 0)}`]);
  }
  if ((payroll.otherDeductions || 0) > 0) {
    deductionItems.push(["Potongan Kasbon / Lainnya", "Cicilan kasbon atau potongan inventaris", `-${formatCurrency(payroll.otherDeductions || 0)}`]);
  }
  if (deductionItems.length === 0) {
    deductionItems.push(["Tidak Ada Potongan", "Disiplin kerja penuh tanpa pemotongan", "Rp 0"]);
  }

  const tableRows: any[] = [];
  tableRows.push([
    { content: "A. PENERIMAAN / PENGHASILAN (EARNINGS)", colSpan: 2, styles: { fillColor: [241, 245, 249], fontStyle: "bold", textColor: [30, 58, 138] } },
    { content: "NOMINAL (IDR)", styles: { fillColor: [241, 245, 249], fontStyle: "bold", halign: "right", textColor: [30, 58, 138] } },
  ]);
  incomeItems.forEach(([title, desc, amount]) => {
    tableRows.push([title, desc, amount]);
  });
  tableRows.push([
    { content: "Subtotal Penghasilan Kotor (Gross)", colSpan: 2, styles: { fontStyle: "bold", halign: "left" } },
    { content: formatCurrency(payroll.grossPay), styles: { fontStyle: "bold", halign: "right", textColor: [15, 23, 42] } },
  ]);

  tableRows.push([
    { content: "B. POTONGAN (DEDUCTIONS)", colSpan: 2, styles: { fillColor: [255, 241, 242], fontStyle: "bold", textColor: [190, 18, 60] } },
    { content: "NOMINAL (IDR)", styles: { fillColor: [255, 241, 242], fontStyle: "bold", halign: "right", textColor: [190, 18, 60] } },
  ]);
  deductionItems.forEach(([title, desc, amount]) => {
    tableRows.push([title, desc, amount]);
  });
  const totalDeductions = (payroll.alphaDeduction || 0) + (payroll.lateDeduction || 0) + (payroll.otherDeductions || 0);
  tableRows.push([
    { content: "Subtotal Total Potongan", colSpan: 2, styles: { fontStyle: "bold", halign: "left", textColor: [225, 29, 72] } },
    { content: `-${formatCurrency(totalDeductions)}`, styles: { fontStyle: "bold", halign: "right", textColor: [225, 29, 72] } },
  ]);

  autoTable(doc, {
    startY: curY,
    head: [["Komponen Gaji", "Keterangan", "Nominal (IDR)"]],
    body: tableRows,
    theme: "grid",
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59],
      cellPadding: 2.2,
    },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: "bold" },
      1: { cellWidth: 86, textColor: [100, 116, 139] },
      2: { cellWidth: 46, halign: "right", fontStyle: "bold" },
    },
    margin: { left: margin, right: margin },
  });

  const finalTableY = (doc as any).lastAutoTable?.finalY || 180;
  curY = finalTableY + 4;

  // 5. TAKE HOME PAY Banner Box
  const thpBoxHeight = 22;
  doc.setFillColor(15, 23, 42); // slate-900
  doc.setDrawColor(245, 158, 11); // amber-500
  doc.setLineWidth(0.8);
  doc.roundedRect(margin, curY, contentWidth, thpBoxHeight, 2.5, 2.5, "FD");

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(251, 191, 36); // amber-400
  doc.text("TAKE HOME PAY (TOTAL GAJI BERSIH DITERIMA)", margin + 6, curY + 7);

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(formatCurrency(payroll.netPay), margin + 6, curY + 16);

  if (paidViaAccountName || payroll.paidDate) {
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(203, 213, 225);
    const paidText = paidViaAccountName
      ? `Dibayar via: ${paidViaAccountName} (${payroll.paidDate ? new Date(payroll.paidDate).toLocaleDateString("id-ID") : "Lunas"})`
      : `Dibayar pada: ${new Date(payroll.paidDate || Date.now()).toLocaleDateString("id-ID")}`;
    doc.text(paidText, pageWidth - margin - 6, curY + 14, { align: "right" });
  }

  curY += thpBoxHeight + 5;

  if (payroll.notes) {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, curY, contentWidth, 10, 1.5, 1.5, "FD");
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(71, 85, 105);
    doc.text(`Catatan: "${payroll.notes}"`, margin + 4, curY + 6.5);
    curY += 14;
  } else {
    curY += 4;
  }

  // 6. Signatures (Penerima & Manajemen)
  const sigBoxY = Math.max(curY, 230);

  // Penerima
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text("Penerima (Karyawan),", margin + 20, sigBoxY);

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(employee.name, margin + 20, sigBoxY + 20);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(employee.position || "Staff", margin + 20, sigBoxY + 24);

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.line(margin + 15, sigBoxY + 21, margin + 65, sigBoxY + 21);

  // Manajemen
  const managerName = payroll.approvedBy || settings.brandName || "Julia's Coffee";
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("Manajemen / Keuangan Outlet,", pageWidth - margin - 20, sigBoxY, { align: "right" });

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(managerName, pageWidth - margin - 20, sigBoxY + 20, { align: "right" });
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  const approvalDate = payroll.approvedAt ? `Disetujui: ${new Date(payroll.approvedAt).toLocaleDateString("id-ID")}` : "Otorisasi Resmi Kedai";
  doc.text(approvalDate, pageWidth - margin - 20, sigBoxY + 24, { align: "right" });

  doc.line(pageWidth - margin - 65, sigBoxY + 21, pageWidth - margin - 15, sigBoxY + 21);

  // 7. Footer Legal Note
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(
    `Dokumen ini dicetak otomatis oleh sistem ${brandName}. Disimpan secara digital dan sah tanpa tanda tangan basah bila berstatus LUNAS.`,
    pageWidth / 2,
    pageHeight - 8,
    { align: "center" }
  );

  const safeEmpName = (employee.name || "Karyawan").replace(/\s+/g, "_");
  const filename = `Slip_Gaji_${safeEmpName}_${payroll.period}.pdf`;
  try {
    if (typeof window !== "undefined") {
      doc.save(filename);
    }
  } catch (saveErr) {
    console.warn("doc.save() direct call skipped (running in non-browser context):", saveErr);
  }
  return doc;
};

